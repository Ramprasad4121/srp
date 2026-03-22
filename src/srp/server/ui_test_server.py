from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

app = FastAPI(title="SRP UI Test", version="1.0")

app.mount("/", StaticFiles(directory="static"), name="static")

@app.get("/api/audit/status")
async def audit_status():
    return {
        "status": "running",
        "logs": [
            "🚀 Audit started — deploying 13 agents...",
            "🕿‍♂️  [SPIDER] Mapping contract dependencies...",
            "🔍 [WATCHDOG] Classifying threat surface..."
        ],
        "findings": [],
        "score": 100,
        "protocol_intent": {
            "protocol_name": "Simple Token",
            "protocol_type": "generic",
            "summary": "Simple ERC-20 token with transfer, mint, and burn functionality",
            "invariants": [
                {
                    "id": "INV-001",
                    "description": "Total supply must always equal sum of all balances",
                    "formal": "totalSupply == sum(balanceOf)",
                    "severity_if_broken": "high",
                    "category": "economic"
                },
                {
                    "id": "INV-002",
                    "description": "Mint and burn operations must update totalSupply correctly",
                    "formal": "totalSupply == totalSupply_before + amount_mint - amount_burn",
                    "severity_if_broken": "high",
                    "category": "state"
                }
            ],
            "access_control_rules": [
                "onlyOwner modifier restricts mint function to contract owner",
                "Owner can mint new tokens but cannot burn tokens they don't own"
            ],
            "trust_assumptions": [
                "Owner is trusted to mint tokens responsibly",
                "No reentrancy protection needed as no external calls in state-changing functions"
            ],
            "critical_functions": ["transfer", "mint", "burn"],
            "economic_model": "Fixed supply with owner-controlled minting"
        }
    }

@app.get("/api/skills")
async def skills():
    return ["Solidity", "ERC-20", "Security Audit", "Smart Contract"]

@app.get("/api/audit/start")
async def start_audit():
    return {"status": "started"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7338)