import os
import asyncio
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel

from srp.core.context.engine import ContextEngine
from srp.core.project import SRPProject

logger = logging.getLogger(__name__)

# Gateway API Router for mounting into the main FastAPI app
gateway_router = APIRouter(prefix="/gateway", tags=["Gateway"])

class WebhookPayload(BaseModel):
    message: str
    channel: str
    user_id: str
    platform: str # "discord", "slack", "telegram", etc.
    target_repo: Optional[str] = None
    
@gateway_router.post("/webhook")
async def handle_webhook(payload: WebhookPayload, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    OpenClaw-style unified Gateway Adapter.
    Standardizes inputs from Discord, Slack, etc., processes them through the Context Engine,
    and spins up the audit swarm in the background.
    """
    logger.info(f"Gateway: Received audit request from {payload.platform} user {payload.user_id}")
    
    # 1. Run through Context Engine (Resolves URLs into raw text immediately)
    engine = ContextEngine()
    enriched_input = await engine.enrich(payload.message)
    
    # 2. Basic environment hookups (Fallback to pwd if no target provided)
    project_root = payload.target_repo if payload.target_repo else os.getcwd()
    try:
        project = SRPProject(project_root)
        if not project.initialized:
            project.initialize()
    except Exception as e:
        logger.warning(f"Gateway couldn't initialize project at {project_root}: {e}")
        raise HTTPException(status_code=500, detail="Failed to hook project root.")

    # 3. Setup Agent Context
    audit_context = {
        "raw_input": enriched_input,
        "platform_source": payload.platform,
        "request_channel": payload.channel,
        "budget_usd": 50.0 # Default budget
    }
    
    # 4. Trigger the background orchestration
    from srp.server.server import run_audit_background
    background_tasks.add_task(run_audit_background, audit_context, project)
    
    # 5. Return immediate 200 OK so the chat platform doesn't timeout
    return {
        "status": "accepted",
        "message": f"SRP Swarm booting for {project_root}. Processing through {payload.platform} gateway.",
        "context_enriched": len(enriched_input) > len(payload.message)
    }
