import { Suspense, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Grid, Text, OrbitControls, Float } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import { parseCode, type VisualEvent, type SimMode } from "@/lib/code-parser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RunState = "idle" | "compiling" | "executing" | "success" | "glitch";

interface SceneState {
  balance: number;
  gateOpen: boolean;
  gateLabel: string;
  particleActive: boolean;
  glitching: boolean;
  shadowActive: boolean;
  emitting: boolean;
  avatarMessage: string;
  avatarPointAt: "vault" | "gate" | "tunnel" | "none";
}

const DEFAULT_SCENE: SceneState = {
  balance: 50,
  gateOpen: false,
  gateLabel: "",
  particleActive: false,
  glitching: false,
  shadowActive: false,
  emitting: false,
  avatarMessage: 'Paste a smart contract and hit ▶ RUN to simulate execution in 3D.',
  avatarPointAt: "none",
};

// ─────────────────────────────────────────────────────────────────────────────
// Code Templates
// ─────────────────────────────────────────────────────────────────────────────

const CODE_TEMPLATES = {
  evm: [
    {
      label: "Safe Bank",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SafeBank {
  mapping(address => uint256) balances;

  function deposit() external payable {
    balances[msg.sender] += msg.value;
    emit Deposit(msg.sender, msg.value);
  }

  // ✓ CEI pattern: Checks → Effects → Interactions
  function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;      // Effect FIRST
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    emit Withdrawal(msg.sender, amount);
  }

  event Deposit(address user, uint256 amount);
  event Withdrawal(address user, uint256 amount);
}`,
    },
    {
      label: "Reentrancy Bug",
      code: `// ⚠️ VULNERABLE — DO NOT DEPLOY
pragma solidity ^0.8.0;

contract VulnerableBank {
  mapping(address => uint256) balances;

  function deposit() external payable {
    balances[msg.sender] += msg.value;
  }

  // BUG: External call BEFORE state update!
  function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    // DANGER: attacker's fallback() re-enters here ↓
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] -= amount; // Too late! Already drained.
  }
}`,
    },
    {
      label: "ERC-20",
      code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20 {
  mapping(address => uint256) public balances;
  mapping(address => mapping(address => uint256)) public allowance;
  uint256 public totalSupply;

  function transfer(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");
    balances[msg.sender] -= amount;
    balances[to] += amount;
    emit Transfer(msg.sender, to, amount);
  }

  function approve(address spender, uint256 amount) external {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
  }

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}`,
    },
  ],
  solana: [
    {
      label: "SPL Transfer",
      code: `// Solana / Anchor Program
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[program]
pub mod srp_token {
  use super::*;

  pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
    // Sealevel: accounts are locked, not program execution
    require!(ctx.accounts.from.amount >= amount, "Low balance");

    token::transfer(
      ctx.accounts.transfer_ctx(),
      amount,
    )?;

    emit!(TransferEvent {
      amount,
      from: ctx.accounts.from.key(),
      to:   ctx.accounts.to.key(),
    });
    Ok(())
  }
}

#[event]
pub struct TransferEvent {
  pub amount: u64,
  pub from:   Pubkey,
  pub to:     Pubkey,
}`,
    },
    {
      label: "Staking",
      code: `// Solana Staking Pool
use anchor_lang::prelude::*;

#[program]
pub mod staking {
  use super::*;

  pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
    require!(amount > 0, "Invalid amount");

    let pool = &mut ctx.accounts.pool;
    pool.total_staked += amount;
    pool.stakers.push(ctx.accounts.user.key());

    emit!(StakeEvent {
      amount,
      user: ctx.accounts.user.key(),
    });
    Ok(())
  }

  pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(pool.total_staked >= amount, "Over limit");
    pool.total_staked -= amount;
    emit!(UnstakeEvent { amount });
    Ok(())
  }
}

#[event]
pub struct StakeEvent   { pub amount: u64, pub user: Pubkey }
#[event]
pub struct UnstakeEvent { pub amount: u64 }`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Syntax Highlighter (dark theme for neural void editor)
// ─────────────────────────────────────────────────────────────────────────────

function highlightCode(code: string): string {
  const keywords =
    /\b(pragma|solidity|contract|interface|library|function|returns|return|external|internal|public|private|view|pure|payable|modifier|event|emit|mapping|address|uint256|uint|int256|int|bool|bytes|bytes32|string|memory|storage|calldata|immutable|constant|constructor|require|revert|assert|if|else|for|while|do|break|continue|new|delete|this|super|msg|block|tx|true|false|struct|enum|import|is|use|pub|fn|let|mut|u64|u128|Result|Ok|Err|mod|impl|pub)\b/g;
  const comments = /(\/\/[^\n]*)/g;
  const strings = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const numbers = /\b(\d+)\b/g;
  const types =
    /\b(uint8|uint16|uint32|uint64|uint128|uint256|int8|address payable|Pubkey|Context|Account|TokenAccount|Token)\b/g;

  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(comments, '<span style="color:#4b5563">$1</span>')
    .replace(strings, '<span style="color:#86efac">$1</span>')
    .replace(keywords, '<span style="color:#c084fc">$1</span>')
    .replace(types, '<span style="color:#67e8f9">$1</span>')
    .replace(numbers, '<span style="color:#fbbf24">$1</span>');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Neural Void Environment
// ─────────────────────────────────────────────────────────────────────────────

function NeuralVoid() {
  return (
    <>
      <color attach="background" args={["#020207"]} />
      <fog attach="fog" args={["#020207", 18, 46]} />
      <ambientLight intensity={0.12} color="#1a0a3e" />
      <pointLight position={[0, 9, 0]} intensity={2.5} color="#7c3aed" distance={22} />
      <pointLight position={[-9, 3, -2]} intensity={1.2} color="#3b82f6" distance={16} />
      <pointLight position={[9, 3, -2]} intensity={1.0} color="#10b981" distance={16} />
      <Stars radius={80} depth={60} count={6000} factor={3} saturation={0.3} fade speed={0.4} />
      <Grid
        position={[0, -0.51, 0]}
        args={[50, 50]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#1a1a3e"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#2d1b69"
        fadeDistance={32}
        fadeStrength={2}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Contract Vault
// ─────────────────────────────────────────────────────────────────────────────

function ContractVault({
  balance,
  active,
  glitching,
}: {
  balance: number;
  active: boolean;
  glitching: boolean;
}) {
  const outerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const fillRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.18;
      if (glitching) {
        outerRef.current.position.x = (Math.random() - 0.5) * 0.22;
        outerRef.current.position.z = (Math.random() - 0.5) * 0.22;
      } else {
        outerRef.current.position.x *= 0.88;
        outerRef.current.position.z *= 0.88;
      }
    }

    if (glowRef.current) {
      glowRef.current.emissiveIntensity = active
        ? 0.45 + Math.sin(t * 4) * 0.3
        : 0.18;
      glowRef.current.color.set(glitching ? "#ff2244" : "#7c3aed");
      glowRef.current.emissive.set(glitching ? "#ff0000" : "#4c1d95");
    }

    if (fillRef.current) {
      const targetScaleY = Math.max(0.01, balance / 100);
      fillRef.current.scale.y +=
        (targetScaleY - fillRef.current.scale.y) * 0.06;
      fillRef.current.position.y =
        -0.8 + fillRef.current.scale.y * 0.8;
    }
  });

  return (
    <Float speed={1.4} floatIntensity={0.18} rotationIntensity={0.04}>
      <group position={[0, 1.6, -2.5]}>
        {/* Wireframe outer */}
        <mesh ref={outerRef}>
          <boxGeometry args={[2.1, 2.1, 2.1]} />
          <meshStandardMaterial
            color="#a855f7"
            emissive="#7c3aed"
            emissiveIntensity={0.5}
            wireframe
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Transparent fill shell */}
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial
            ref={glowRef}
            color="#7c3aed"
            emissive="#4c1d95"
            emissiveIntensity={0.18}
            transparent
            opacity={0.08}
          />
        </mesh>
        {/* Balance fill bar */}
        <mesh ref={fillRef} position={[0, -0.8, 0]}>
          <boxGeometry args={[1.5, 1.6, 1.5]} />
          <meshStandardMaterial
            color={glitching ? "#ef4444" : "#22c55e"}
            emissive={glitching ? "#ef4444" : "#16a34a"}
            emissiveIntensity={1.1}
            transparent
            opacity={0.75}
          />
        </mesh>
        {/* Labels */}
        <Text
          position={[0, -1.45, 1.1]}
          fontSize={0.145}
          color="#a78bfa"
          anchorX="center"
        >
          CONTRACT VAULT
        </Text>
        <Text
          position={[0, -1.7, 1.1]}
          fontSize={0.11}
          color="#6b7280"
          anchorX="center"
        >
          {`state.balance = ${balance}`}
        </Text>
      </group>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Data Particle
// ─────────────────────────────────────────────────────────────────────────────

function DataParticle({
  startX,
  endX,
  z = 0,
  speed = 0.45,
  color = "#a855f7",
  delay = 0,
  active,
}: {
  startX: number;
  endX: number;
  z?: number;
  speed?: number;
  color?: string;
  delay?: number;
  active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const progress = useRef(delay);

  useFrame((_, delta) => {
    if (!active || !ref.current) return;
    progress.current = (progress.current + delta * speed) % 1;
    ref.current.position.x =
      startX + (endX - startX) * progress.current;
    ref.current.position.z = z;
    ref.current.position.y =
      0.32 + Math.sin(progress.current * Math.PI * 5) * 0.09;
  });

  return (
    <mesh ref={ref} position={[startX, 0.32, z]} visible={active}>
      <sphereGeometry args={[0.075, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={3.5}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: EVM Sequential Tunnel
// ─────────────────────────────────────────────────────────────────────────────

function EVMTunnel({
  active,
  glitching,
}: {
  active: boolean;
  glitching: boolean;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = active
      ? 0.4 + Math.sin(state.clock.elapsedTime * 5) * 0.25
      : 0.1;
    matRef.current.color.set(glitching ? "#ff2244" : "#7c3aed");
    matRef.current.emissive.set(glitching ? "#ff0000" : "#4c1d95");
  });

  const color = glitching ? "#ff2244" : "#7c3aed";

  return (
    <group>
      {/* Tube body */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 16, 16, 1, true]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          transparent
          opacity={0.13}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Wireframe tube */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.37, 0.37, 16.1, 12, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={0.38}
          wireframe
        />
      </mesh>
      {/* Particles */}
      {[0, 0.25, 0.5, 0.75].map((d, i) => (
        <DataParticle
          key={i}
          startX={-8}
          endX={8}
          z={0}
          speed={0.5}
          color="#a855f7"
          delay={d}
          active={active}
        />
      ))}
      {/* Labels */}
      <Text
        position={[-7.5, 0.95, 0]}
        fontSize={0.17}
        color="#374151"
        anchorX="left"
      >
        MEMPOOL
      </Text>
      <Text
        position={[5.8, 0.95, 0]}
        fontSize={0.17}
        color="#374151"
        anchorX="left"
      >
        CONFIRMED ✓
      </Text>
      <Text
        position={[0, -0.28, 0]}
        fontSize={0.13}
        color="#2d1b69"
        anchorX="center"
      >
        EVM — Sequential Execution (Single Thread)
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Solana Parallel Lanes (Sealevel)
// ─────────────────────────────────────────────────────────────────────────────

function SolanaLanes({ active }: { active: boolean }) {
  const LANES = [
    { z: -2.8, color: "#10b981", label: "Account Lane A", speed: 0.55 },
    { z: 0,    color: "#3b82f6", label: "Account Lane B", speed: 0.6  },
    { z: 2.8,  color: "#06b6d4", label: "Account Lane C", speed: 0.65 },
  ];

  return (
    <group>
      {LANES.map((lane, li) => (
        <group key={li}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.32, lane.z]}>
            <cylinderGeometry args={[0.28, 0.28, 16, 12, 1, true]} />
            <meshStandardMaterial
              color={lane.color}
              emissive={lane.color}
              emissiveIntensity={0.1}
              transparent
              opacity={0.12}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.32, lane.z]}>
            <cylinderGeometry args={[0.29, 0.29, 16.1, 10, 1, true]} />
            <meshStandardMaterial
              color={lane.color}
              emissive={lane.color}
              emissiveIntensity={0.45}
              transparent
              opacity={0.32}
              wireframe
            />
          </mesh>
          {[0, 0.34, 0.67].map((d, i) => (
            <DataParticle
              key={i}
              startX={-8}
              endX={8}
              z={lane.z}
              speed={lane.speed}
              color={lane.color}
              delay={d}
              active={active}
            />
          ))}
          <Text
            position={[-7.8, 0.9, lane.z]}
            fontSize={0.155}
            color={lane.color}
            anchorX="left"
          >
            {lane.label}
          </Text>
        </group>
      ))}
      <Text
        position={[0, -0.75, 0]}
        fontSize={0.14}
        color="#1d4ed8"
        anchorX="center"
      >
        Solana Sealevel — 3 Accounts in Parallel
      </Text>
      <Text
        position={[0, -1.0, 0]}
        fontSize={0.11}
        color="#1e3a5f"
        anchorX="center"
      >
        Independent state — no locking required
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Logic Gate
// ─────────────────────────────────────────────────────────────────────────────

function LogicGate({
  x = 0,
  z = 0,
  open,
  label,
  glitching,
}: {
  x?: number;
  z?: number;
  open: boolean;
  label: string;
  glitching: boolean;
}) {
  const gateRef = useRef<THREE.Mesh>(null);
  const scaleYRef = useRef(1);

  useFrame((state) => {
    const target = open ? 0.02 : 1;
    scaleYRef.current += (target - scaleYRef.current) * 0.09;
    if (!gateRef.current) return;
    gateRef.current.scale.y = scaleYRef.current;
    const mat = gateRef.current.material as THREE.MeshStandardMaterial;
    const t = state.clock.elapsedTime;
    if (open) {
      mat.color.set("#22c55e");
      mat.emissive.set("#16a34a");
      mat.emissiveIntensity = 0.7;
    } else if (glitching) {
      mat.color.set("#ff2244");
      mat.emissive.set("#ff0000");
      mat.emissiveIntensity = 0.9 + Math.sin(t * 20) * 0.1;
    } else {
      mat.color.set("#ef4444");
      mat.emissive.set("#dc2626");
      mat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <group position={[x, 0.32, z]}>
      <mesh ref={gateRef}>
        <boxGeometry args={[0.1, 1.4, 1.0]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#dc2626"
          emissiveIntensity={0.5}
          transparent
          opacity={0.75}
        />
      </mesh>
      <Text
        position={[0, 1.15, 0]}
        fontSize={0.115}
        color={open ? "#22c55e" : "#ef4444"}
        anchorX="center"
        maxWidth={4}
      >
        {label.slice(0, 42)}
      </Text>
      <Text
        position={[0, -0.55, 0.62]}
        fontSize={0.105}
        color={open ? "#16a34a" : "#991b1b"}
        anchorX="center"
      >
        {open ? "✓ PASS" : "CHECKING"}
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Shadow Attacker (reentrancy)
// ─────────────────────────────────────────────────────────────────────────────

function ShadowAttacker({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const xPos = useRef(-14);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const target = active ? -2.5 : -14;
    xPos.current += (target - xPos.current) * (delta * 1.8);
    groupRef.current.position.x = xPos.current;
    groupRef.current.position.y =
      Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.12;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.25;
  });

  return (
    <group ref={groupRef} position={[-14, 0, -2]}>
      {/* Body */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.23, 0.3, 1.15, 8]} />
        <meshStandardMaterial
          color="#0a0000"
          emissive="#ff0000"
          emissiveIntensity={0.9}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.65, 0]}>
        <icosahedronGeometry args={[0.29, 0]} />
        <meshStandardMaterial
          color="#050000"
          emissive="#ff2244"
          emissiveIntensity={1.6}
        />
      </mesh>
      {/* Eyes */}
      {[-0.1, 0.1].map((ex, i) => (
        <mesh key={i} position={[ex, 1.7, 0.24]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial
            color="#ff0000"
            emissive="#ff0000"
            emissiveIntensity={5}
          />
        </mesh>
      ))}
      {/* Arms */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * 0.45, 0.85, 0]} rotation={[0, 0, side * 0.5]}>
          <cylinderGeometry args={[0.06, 0.06, 0.75, 6]} />
          <meshStandardMaterial
            color="#0a0000"
            emissive="#ff0000"
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.18}
        color="#ff2244"
        anchorX="center"
      >
        ⚠ ATTACKER
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: AI Avatar Mentor
// ─────────────────────────────────────────────────────────────────────────────

function AvatarMentor({
  pointAt,
}: {
  pointAt: "vault" | "gate" | "tunnel" | "none";
}) {
  const bodyRef = useRef<THREE.Mesh>(null);
  const armRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const armAngle = useRef(0);

  const TARGET_ANGLES = {
    vault: -0.7,
    gate: -0.25,
    tunnel: 0.2,
    none: 0,
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const target = TARGET_ANGLES[pointAt];
    armAngle.current += (target - armAngle.current) * 0.06;

    if (bodyRef.current) {
      bodyRef.current.position.y = 0.72 + Math.sin(t * 1.5) * 0.055;
    }
    if (armRef.current) {
      armRef.current.rotation.z = armAngle.current - 0.28;
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.75) * 0.22;
    }
  });

  return (
    <group position={[7, 0, -2.5]}>
      {/* Platform */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.1, 16]} />
        <meshStandardMaterial
          color="#1a0a3e"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
        />
      </mesh>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.21, 0.27, 0.88, 12]} />
        <meshStandardMaterial
          color="#2d1b69"
          emissive="#7c3aed"
          emissiveIntensity={0.85}
        />
      </mesh>
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.48, 0]}>
        <icosahedronGeometry args={[0.27, 1]} />
        <meshStandardMaterial
          color="#1e1b4b"
          emissive="#7c3aed"
          emissiveIntensity={0.65}
        />
      </mesh>
      {/* Eyes */}
      {[-0.1, 0.1].map((ex, i) => (
        <mesh key={i} position={[ex, 1.53, 0.22]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial
            color="#a855f7"
            emissive="#c084fc"
            emissiveIntensity={5}
          />
        </mesh>
      ))}
      {/* Pointing arm */}
      <mesh
        ref={armRef}
        position={[-0.43, 0.93, 0]}
        rotation={[0, 0, -0.28]}
      >
        <cylinderGeometry args={[0.055, 0.055, 0.72, 8]} />
        <meshStandardMaterial
          color="#2d1b69"
          emissive="#7c3aed"
          emissiveIntensity={0.65}
        />
      </mesh>
      {/* Fingertip */}
      <mesh position={[-0.84, 0.68, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#c084fc"
          emissiveIntensity={4}
        />
      </mesh>
      {/* Resting arm */}
      <mesh position={[0.42, 0.84, 0]} rotation={[0, 0, 0.42]}>
        <cylinderGeometry args={[0.055, 0.055, 0.62, 8]} />
        <meshStandardMaterial
          color="#2d1b69"
          emissive="#7c3aed"
          emissiveIntensity={0.45}
        />
      </mesh>
      <Text position={[0, 1.98, 0]} fontSize={0.13} color="#a78bfa" anchorX="center">
        AI MENTOR
      </Text>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Camera Glitch Effect
// ─────────────────────────────────────────────────────────────────────────────

function GlitchCamera({ active }: { active: boolean }) {
  const { camera } = useThree();
  const BASE_X = 0;
  const BASE_Y = 7;

  useFrame(() => {
    if (active) {
      camera.position.x = BASE_X + (Math.random() - 0.5) * 0.32;
      camera.position.y = BASE_Y + (Math.random() - 0.5) * 0.22;
    } else {
      camera.position.x += (BASE_X - camera.position.x) * 0.06;
      camera.position.y += (BASE_Y - camera.position.y) * 0.06;
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D: Scene Composition
// ─────────────────────────────────────────────────────────────────────────────

function SimulatorScene({
  mode,
  sceneState,
  events,
  currentEventIdx,
}: {
  mode: SimMode;
  sceneState: SceneState;
  events: VisualEvent[];
  currentEventIdx: number;
}) {
  const gates = events
    .filter((e) => e.type === "logic_gate")
    .map((e, i) => ({
      x: -5 + i * 3.2,
      label: e.label ?? "require",
      open: currentEventIdx >= events.indexOf(e) + 1,
    }));

  return (
    <>
      <NeuralVoid />
      <GlitchCamera active={sceneState.glitching} />

      {mode === "evm" ? (
        <EVMTunnel
          active={sceneState.particleActive}
          glitching={sceneState.glitching}
        />
      ) : (
        <SolanaLanes active={sceneState.particleActive} />
      )}

      <ContractVault
        balance={sceneState.balance}
        active={sceneState.particleActive}
        glitching={sceneState.glitching}
      />

      {gates.slice(0, 3).map((g, i) => (
        <LogicGate
          key={i}
          x={g.x}
          z={mode === "evm" ? 0 : 0}
          open={g.open}
          label={g.label}
          glitching={sceneState.glitching}
        />
      ))}

      <ShadowAttacker active={sceneState.shadowActive} />
      <AvatarMentor pointAt={sceneState.avatarPointAt} />

      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5}
        maxDistance={24}
        target={[0, 1, 0]}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Simulator Page
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function Simulator({ onBack }: Props) {
  const [mode, setMode] = useState<SimMode>("evm");
  const [runState, setRunState] = useState<RunState>("idle");
  const [code, setCode] = useState(CODE_TEMPLATES.evm[0].code);
  const [sceneState, setSceneState] = useState<SceneState>(DEFAULT_SCENE);
  const [events, setEvents] = useState<VisualEvent[]>([]);
  const [currentEventIdx, setCurrentEventIdx] = useState(-1);
  const [showCode, setShowCode] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const patch = useCallback((p: Partial<SceneState>) => {
    setSceneState((prev) => ({ ...prev, ...p }));
  }, []);

  const handleReset = useCallback(() => {
    clearTimers();
    setRunState("idle");
    setEvents([]);
    setCurrentEventIdx(-1);
    setSceneState(DEFAULT_SCENE);
  }, []);

  const handleRun = useCallback(() => {
    if (runState === "executing" || runState === "compiling") return;
    clearTimers();

    const parsed = parseCode(code, mode);
    setEvents(parsed);
    setCurrentEventIdx(-1);
    setRunState("compiling");
    patch({
      ...DEFAULT_SCENE,
      balance: 50,
      avatarMessage: "Compiling… parsing your contract into visual keyframes.",
    });

    const boot = setTimeout(() => {
      setRunState("executing");
      patch({
        particleActive: true,
        avatarMessage:
          mode === "evm"
            ? "Execution started — watch transactions flow through the EVM tunnel!"
            : "Sealevel engaged — 3 account lanes processing in parallel!",
      });

      parsed.forEach((ev, idx) => {
        const t = setTimeout(() => {
          setCurrentEventIdx(idx);

          if (ev.type === "vault_change") {
            setSceneState((prev) => ({
              ...prev,
              balance: Math.max(0, Math.min(100, prev.balance + (ev.value ?? 0))),
              avatarMessage:
                (ev.value ?? 0) > 0
                  ? "Balance increasing — SSTORE writes to storage slot [1]. Vault filling!"
                  : "Balance decreasing — SSTORE: state updated. Watch the vault shrink.",
              avatarPointAt: "vault",
            }));
          } else if (ev.type === "logic_gate") {
            patch({
              gateOpen: false,
              gateLabel: ev.label ?? "",
              avatarMessage: `Logic gate: "${ev.label?.slice(0, 55)}" — evaluating condition…`,
              avatarPointAt: "gate",
            });
            const open = setTimeout(
              () =>
                patch({
                  gateOpen: true,
                  avatarMessage: "✓ Condition passed! Gate opens — execution continues.",
                }),
              620
            );
            timers.current.push(open);
          } else if (ev.type === "emit_event") {
            patch({
              emitting: true,
              avatarMessage: `Event emitted: ${ev.label} — recorded on-chain forever.`,
              avatarPointAt: "tunnel",
            });
            const stop = setTimeout(() => patch({ emitting: false }), 850);
            timers.current.push(stop);
          } else if (ev.type === "reentrancy") {
            setRunState("glitch");
            patch({
              glitching: true,
              shadowActive: true,
              avatarMessage:
                "⚠️ REENTRANCY ATTACK! External call before state update — the Shadow Attacker can drain the vault repeatedly before balances is reduced!",
              avatarPointAt: "vault",
            });
            const stopGlitch = setTimeout(() => {
              patch({ glitching: false });
              setRunState("executing");
            }, 3500);
            timers.current.push(stopGlitch);
          } else if (ev.type === "call") {
            patch({
              avatarMessage:
                "External call — crossing the contract boundary. Data leaving the EVM.",
              avatarPointAt: "tunnel",
            });
          } else if (ev.type === "store") {
            patch({
              avatarMessage:
                "SSTORE detected — writing persistent state. Costs 20,000 gas for a new slot.",
              avatarPointAt: "vault",
            });
          } else if (ev.type === "loop") {
            patch({
              avatarMessage:
                "Loop detected — gas cost scales O(n) with input size. Unbounded loops can cause DoS!",
              avatarPointAt: "tunnel",
            });
          } else if (ev.type === "success") {
            setRunState("success");
            patch({
              particleActive: false,
              shadowActive: false,
              glitching: false,
              avatarMessage:
                "✓ Execution complete! All operations committed. Contract state is finalized on-chain.",
              avatarPointAt: "none",
            });
          }
        }, ev.delay);
        timers.current.push(t);
      });

      if (parsed.length === 0) {
        setRunState("idle");
        patch({
          particleActive: false,
          avatarMessage:
            "No executable opcodes found. Try one of the preset templates to see the 3D simulation!",
        });
      }
    }, 900);

    timers.current.push(boot);
  }, [code, mode, runState, patch]);

  const switchMode = (m: SimMode) => {
    setMode(m);
    setCode(CODE_TEMPLATES[m][0].code);
    handleReset();
  };

  const templates = CODE_TEMPLATES[mode];

  const STATUS_DOT: Record<RunState, string> = {
    idle: "bg-gray-600",
    compiling: "bg-amber-400 animate-pulse",
    executing: "bg-blue-400 animate-pulse",
    success: "bg-green-400",
    glitch: "bg-red-400 animate-pulse",
  };
  const STATUS_LABEL: Record<RunState, string> = {
    idle: "IDLE",
    compiling: "COMPILING",
    executing: "EXECUTING",
    success: "SUCCESS",
    glitch: "REENTRANCY!",
  };
  const STATUS_COLOR: Record<RunState, string> = {
    idle: "#4b5563",
    compiling: "#fbbf24",
    executing: "#60a5fa",
    success: "#4ade80",
    glitch: "#f87171",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#020207" }}
    >
      {/* ── Top Bar ── */}
      <div
        className="shrink-0 h-11 flex items-center gap-3 px-4 border-b"
        style={{ borderColor: "#1a1a3e", background: "#03030c" }}
      >
        <button
          onClick={onBack}
          className="font-mono text-xs transition-colors"
          style={{ color: "#4b5563" }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.color = "#a78bfa")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.color = "#4b5563")
          }
        >
          ← back
        </button>
        <span
          className="font-mono text-xs font-bold tracking-widest"
          style={{ color: "#a78bfa" }}
        >
          SRP LEARN 3D
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "#2d1b69" }}
        >
          / Neural Void Simulator
        </span>
        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center gap-1">
          {(["evm", "solana"] as SimMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="font-mono text-[10px] font-bold px-2.5 py-1 border tracking-widest uppercase transition-all"
              style={{
                borderColor:
                  mode === m
                    ? m === "evm"
                      ? "#7c3aed"
                      : "#10b981"
                    : "#1f2937",
                background:
                  mode === m
                    ? m === "evm"
                      ? "#7c3aed22"
                      : "#10b98122"
                    : "transparent",
                color:
                  mode === m
                    ? m === "evm"
                      ? "#c084fc"
                      : "#34d399"
                    : "#374151",
              }}
            >
              {m === "evm" ? "⬡ EVM" : "◈ Solana"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCode((s) => !s)}
          className="font-mono text-[10px] transition-colors ml-1"
          style={{ color: "#374151" }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.color = "#a78bfa")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.color = "#374151")
          }
        >
          {showCode ? "⊡ Hide Code" : "⊞ Show Code"}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code Panel */}
        <AnimatePresence>
          {showCode && (
            <motion.div
              key="code-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "37%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="shrink-0 flex flex-col overflow-hidden border-r"
              style={{ borderColor: "#1a1a3e", background: "#06060f" }}
            >
              {/* Template selector */}
              <div
                className="shrink-0 px-3 py-2 flex gap-1.5 overflow-x-auto border-b"
                style={{ borderColor: "#111827" }}
              >
                {templates.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => {
                      setCode(tpl.code);
                      handleReset();
                    }}
                    className="font-mono text-[10px] border px-2 py-1 whitespace-nowrap transition-colors"
                    style={{
                      borderColor: "#1f2937",
                      color: "#4b5563",
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.color = "#c084fc";
                      (e.target as HTMLElement).style.borderColor = "#4c1d95";
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.color = "#4b5563";
                      (e.target as HTMLElement).style.borderColor = "#1f2937";
                    }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {/* Code editor */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  className="absolute inset-0 font-mono text-xs p-3 pointer-events-none overflow-auto whitespace-pre leading-relaxed"
                  style={{ color: "transparent" }}
                  dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
                />
                <textarea
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    handleReset();
                  }}
                  className="absolute inset-0 w-full h-full font-mono text-xs p-3 bg-transparent text-transparent resize-none outline-none leading-relaxed"
                  style={{ caretColor: "#c084fc" }}
                  spellCheck={false}
                />
              </div>

              {/* Controls */}
              <div
                className="shrink-0 border-t p-3 space-y-3"
                style={{ borderColor: "#111827" }}
              >
                {/* Status row */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[runState]}`}
                  />
                  <span
                    className="font-mono text-[10px] uppercase tracking-widest"
                    style={{ color: STATUS_COLOR[runState] }}
                  >
                    {STATUS_LABEL[runState]}
                  </span>
                  {currentEventIdx >= 0 && events.length > 0 && (
                    <span
                      className="font-mono text-[10px] ml-auto"
                      style={{ color: "#374151" }}
                    >
                      {currentEventIdx + 1}/{events.length} ops
                    </span>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleRun}
                    disabled={
                      runState === "executing" || runState === "compiling"
                    }
                    className="flex-1 font-mono text-xs font-bold py-2.5 border flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                    style={{
                      background:
                        runState === "executing" || runState === "compiling"
                          ? "transparent"
                          : "#7c3aed",
                      borderColor: "#7c3aed",
                      color:
                        runState === "executing" || runState === "compiling"
                          ? "#7c3aed"
                          : "#fff",
                    }}
                  >
                    <Play className="w-3 h-3" />
                    {runState === "compiling"
                      ? "Compiling…"
                      : runState === "executing"
                      ? "Running…"
                      : "▶ RUN"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="font-mono text-xs border px-3 py-2.5 transition-colors"
                    style={{ borderColor: "#1f2937", color: "#4b5563" }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = "#9ca3af")
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = "#4b5563")
                    }
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Avatar speech bubble */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={sceneState.avatarMessage}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="shrink-0 border-t p-3"
                  style={{
                    borderColor: "#111827",
                    background: sceneState.glitching ? "#1a0505" : "#07060e",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center mt-0.5 text-[8px]"
                      style={{
                        background: "#2d1b69",
                        boxShadow: "0 0 10px #7c3aed88",
                        color: "#c084fc",
                      }}
                    >
                      ✦
                    </div>
                    <p
                      className="font-mono text-[10px] leading-relaxed"
                      style={{
                        color: sceneState.glitching ? "#ff7090" : "#a78bfa",
                      }}
                    >
                      {sceneState.avatarMessage}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: 3D Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <Canvas
            camera={{ position: [0, 7, 13], fov: 60 }}
            gl={{ antialias: true, alpha: false }}
            style={{
              filter: sceneState.glitching
                ? "hue-rotate(160deg) saturate(1.8) brightness(0.9)"
                : "none",
              transition: "filter 0.08s",
            }}
          >
            <Suspense fallback={null}>
              <SimulatorScene
                mode={mode}
                sceneState={sceneState}
                events={events}
                currentEventIdx={currentEventIdx}
              />
            </Suspense>
          </Canvas>

          {/* HUD overlays */}
          <div className="absolute top-3 right-3 space-y-1.5 pointer-events-none">
            <div
              className="font-mono text-[10px] px-2 py-1 border"
              style={{
                borderColor: "#2d1b69",
                background: "#020207cc",
                color: "#6b21a8",
              }}
            >
              {mode === "evm" ? "⬡ EVM SEQUENTIAL" : "◈ SEALEVEL PARALLEL"}
            </div>

            {sceneState.glitching && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.28 }}
                className="font-mono text-[10px] px-2 py-1 border"
                style={{
                  borderColor: "#ff2244",
                  background: "#1a0008",
                  color: "#ff4466",
                }}
              >
                ⚠ REENTRANCY ATTACK
              </motion.div>
            )}

            {runState === "success" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono text-[10px] px-2 py-1 border"
                style={{
                  borderColor: "#16a34a",
                  background: "#061409",
                  color: "#4ade80",
                }}
              >
                ✓ EXECUTION COMPLETE
              </motion.div>
            )}
          </div>

          {/* Show code btn when hidden */}
          {!showCode && (
            <button
              onClick={() => setShowCode(true)}
              className="absolute bottom-4 left-4 font-mono text-[10px] border px-3 py-2 transition-colors"
              style={{
                borderColor: "#7c3aed",
                background: "#020207ee",
                color: "#a78bfa",
              }}
            >
              {"</>"}  Show Code
            </button>
          )}

          {/* Legend */}
          <div
            className="absolute bottom-3 right-3 space-y-1 pointer-events-none"
            style={{ background: "#020207bb", padding: "8px 10px" }}
          >
            {[
              { color: "#a855f7", label: "Data packet" },
              { color: "#22c55e", label: "Contract state" },
              { color: "#ef4444", label: "Logic gate" },
              { color: "#ff2244", label: "Attack vector" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: item.color,
                    boxShadow: `0 0 5px ${item.color}`,
                  }}
                />
                <span
                  className="font-mono text-[9px]"
                  style={{ color: "#374151" }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
