import test from "node:test";
import assert from "node:assert/strict";
import { discoverVulnerabilities, runAudit } from "../src/index.ts";
import type { ProtocolInput } from "../src/types.ts";

function sol(content: string): ProtocolInput {
  return { name: "Program", chain: "solana", documents: [], sources: [{ path: "programs/vault/src/lib.rs", language: "rust", content }] };
}
const ids = (content: string) => discoverVulnerabilities(sol(content)).map((finding) => finding.detector);

const HEAD = `use anchor_lang::prelude::*;
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
#[program]
pub mod vault {
    use super::*;
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> { Ok(()) }
}
#[account]
pub struct Vault { pub authority: Pubkey, pub balance: u64 }
`;

const VULN = HEAD + `#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: no checks
    pub authority: AccountInfo<'info>,
}`;

const SAFE = HEAD + `#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = authority)]
    pub vault: Account<'info, Vault>,
    pub authority: Signer<'info>,
}`;

test("anchor: AccountInfo authority with no signer constraint is a critical missing-signer finding", () => {
  const hit = discoverVulnerabilities(sol(VULN)).find((finding) => finding.detector === "solana-missing-signer");
  assert.ok(hit);
  assert.equal(hit.proposedSeverity, "critical");
  assert.equal(hit.evidence[0]?.startLine, 15);
  assert.equal(hit.evidence[0]?.provider, "srp-anchor");
});

test("anchor: vault with stored authority but no has_one is flagged", () => {
  assert.ok(ids(VULN).includes("solana-missing-has-one"));
});

test("anchor: Signer + has_one is clean", () => {
  const found = ids(SAFE);
  assert.ok(!found.includes("solana-missing-signer"));
  assert.ok(!found.includes("solana-missing-has-one"));
});

test("anchor: Signer without has_one still flags missing has_one", () => {
  assert.ok(ids(SAFE.replace("mut, has_one = authority", "mut")).includes("solana-missing-has-one"));
});

test("anchor: init_if_needed is flagged unless an is_initialized guard exists", () => {
  const src = HEAD + `#[derive(Accounts)]
pub struct Init<'info> {
    #[account(init_if_needed, payer = payer, space = 8 + 40)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}`;
  assert.ok(ids(src).includes("solana-init-if-needed-reinit"));
  assert.ok(!ids(src + "\nfn guard(v: &Vault) { require!(!v.is_initialized, E::X); }").includes("solana-init-if-needed-reinit"));
});

test("anchor: CPI to an unpinned AccountInfo program is flagged, Program<'info, Token> is not", () => {
  const bad = HEAD + `#[derive(Accounts)]
pub struct Pay<'info> {
    pub authority: Signer<'info>,
    /// CHECK: program
    pub token_program: AccountInfo<'info>,
}
fn pay(ctx: Context<Pay>) -> Result<()> { invoke(&ix, &[ctx.accounts.token_program.clone()])?; Ok(()) }`;
  const good = bad.replace("/// CHECK: program\n    pub token_program: AccountInfo<'info>,", "pub token_program: Program<'info, Token>,");
  assert.ok(ids(bad).includes("solana-arbitrary-cpi"));
  assert.ok(!ids(good).includes("solana-arbitrary-cpi"));
});

test("anchor: presence of seeds/bump/invoke_signed alone no longer produces findings (false positive fix)", () => {
  const src = HEAD + `#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, seeds = [b"vault", authority.key().as_ref()], bump, has_one = authority)]
    pub vault: Account<'info, Vault>,
    pub authority: Signer<'info>,
}`;
  assert.deepEqual(ids(src), []);
});

test("native (non-Anchor) Solana programs are reported as a high residual unknown, not silently passed", () => {
  const report = runAudit(sol(`use solana_program::entrypoint;\nentrypoint!(process);\nfn process() {}`));
  assert.ok(report.unknowns.some((unknown) => unknown.severity === "high" && /Native/.test(unknown.reason)));
});

const RAW_HEAD = `use anchor_lang::prelude::*;
#[program]
pub mod p {
    use super::*;
    pub fn log_message(ctx: Context<LogMessage>) -> ProgramResult {
        let token = SplTokenAccount::unpack(&ctx.accounts.token.data.borrow())?;
        BODY
        Ok(())
    }
}
#[derive(Accounts)]
pub struct LogMessage<'info> {
    token: AccountInfo<'info>,
    authority: Signer<'info>,
}`;

test("anchor: raw token account read with no owner check and no data matching is flagged (sealevel 1 and 2)", () => {
  const found = ids(RAW_HEAD.replace("BODY", ""));
  assert.ok(found.includes("solana-unchecked-account-owner"));
  assert.ok(found.includes("solana-account-data-matching"));
});

test("anchor: owner and data checks clear both findings", () => {
  const body = `if ctx.accounts.token.owner != &spl_token::ID { return Err(E); }
        if ctx.accounts.authority.key != &token.owner { return Err(E); }`;
  const found = ids(RAW_HEAD.replace("BODY", body));
  assert.ok(!found.includes("solana-unchecked-account-owner"));
  assert.ok(!found.includes("solana-account-data-matching"));
});

test("anchor: fields without pub are parsed (sealevel style)", () => {
  const src = `use anchor_lang::prelude::*;
#[derive(Accounts)]
pub struct LogMessage<'info> {
    authority: AccountInfo<'info>,
}`;
  assert.ok(ids(src).includes("solana-missing-signer"));
  assert.ok(!ids(src + "\nfn f(ctx: Context<LogMessage>) { if !ctx.accounts.authority.is_signer { return; } }").includes("solana-missing-signer"));
});

test("anchor: duplicate mutable accounts flagged unless keys are compared or pinned by has_one", () => {
  const src = `use anchor_lang::prelude::*;
pub fn update(ctx: Context<Update>, a: u64) -> Result<()> { ctx.accounts.user_a.data = a; ctx.accounts.user_b.data = a; Ok(()) }
#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}
#[account]
pub struct User { data: u64 }`;
  assert.ok(ids(src).includes("solana-duplicate-mutable-accounts"));
  assert.ok(!ids(src.replace("ctx.accounts.user_a.data = a;", "if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() { return err!(E::X); } ctx.accounts.user_a.data = a;")).includes("solana-duplicate-mutable-accounts"));
});

test("anchor: sysvar AccountInfo without address check is flagged; require_eq against the id is clean", () => {
  const src = `use anchor_lang::prelude::*;
pub fn check(ctx: Context<C>) -> Result<()> { BODY Ok(()) }
#[derive(Accounts)]
pub struct C<'info> { rent: AccountInfo<'info>, }`;
  assert.ok(ids(src.replace("BODY", "")).includes("solana-sysvar-address-unchecked"));
  assert.ok(!ids(src.replace("BODY", "require_eq!(ctx.accounts.rent.key(), sysvar::rent::ID);")).includes("solana-sysvar-address-unchecked"));
});

test("anchor: manual close that only zeroes lamports is flagged; close constraint is clean", () => {
  const src = `use anchor_lang::prelude::*;
pub fn close(ctx: Context<Close>) -> Result<()> { **ctx.accounts.account.to_account_info().lamports.borrow_mut() = 0; Ok(()) }
#[derive(Accounts)]
pub struct Close<'info> { account: Account<'info, Data>, destination: AccountInfo<'info>, }`;
  assert.ok(ids(src).includes("solana-manual-close-revival"));
  assert.ok(!ids(src.replace("account: Account<'info, Data>", "#[account(mut, close = destination)] account: Account<'info, Data>")).includes("solana-manual-close-revival"));
});

test("anchor: borsh try_from_slice without discriminator is type cosplay", () => {
  const src = `use anchor_lang::prelude::*;
pub fn u(ctx: Context<U>) -> ProgramResult { let user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap(); if ctx.accounts.user.owner != ctx.program_id { return Err(E); } Ok(()) }
#[derive(Accounts)]
pub struct U<'info> { user: AccountInfo<'info>, authority: Signer<'info>, }`;
  assert.ok(ids(src).includes("solana-type-cosplay"));
  assert.ok(!ids(src).includes("solana-unchecked-account-owner"));
});
