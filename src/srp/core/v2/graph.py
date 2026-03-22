"""
core/v2/graph.py
Lightweight DAG-based State Machine for SRP V2 Agents.
Replaces static linear loops with an explicit graph execution model
(inspired by LangGraph/OpenClaw architectures).
"""
from typing import Callable, Dict, Any, Awaitable, Tuple
import asyncio
import logging

logger = logging.getLogger(__name__)

class END:
    pass

class StateGraph:
    """
    A state machine graph where nodes are functions that receive and return a state dictionary,
    and edges determine which node executes next.
    """
    def __init__(self):
        self.nodes: Dict[str, Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]] = {}
        self.edges: Dict[str, str] = {}
        self.conditional_edges: Dict[str, Callable[[Dict[str, Any]], str]] = {}
        self.entry_point: str = ""

    def add_node(self, name: str, action: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]):
        """Register a node in the execution graph."""
        self.nodes[name] = action

    def set_entry_point(self, name: str):
        """Set the starting node."""
        self.entry_point = name

    def add_edge(self, start_node: str, end_node: str):
        """Add a direct unconditional edge between nodes."""
        self.edges[start_node] = end_node

    def add_conditional_edges(self, start_node: str, condition: Callable[[Dict[str, Any]], str]):
        """
        Add a conditional edge. The condition function receives the state and 
        returns the name of the next node to execute (or END).
        """
        self.conditional_edges[start_node] = condition

    async def compile(self, initial_state: Dict[str, Any], max_steps: int = 50) -> Dict[str, Any]:
        """
        Execute the graph asynchronously until END is reached or max_steps exceeded.
        """
        if not self.entry_point:
            raise ValueError("Entry point not set")
            
        current_node = self.entry_point
        state = initial_state
        steps = 0

        while current_node is not END and steps < max_steps:
            if current_node not in self.nodes:
                raise ValueError(f"Node '{current_node}' not found in graph")
                
            logger.debug(f"[Graph] Executing node: {current_node}")
            action = self.nodes[current_node]
            
            # Execute node
            new_state_updates = await action(state)
            
            # Update state with returned keys
            if new_state_updates:
                state.update(new_state_updates)
                
            steps += 1
            
            # Determine next node
            if current_node in self.conditional_edges:
                condition = self.conditional_edges[current_node]
                next_node = condition(state)
            elif current_node in self.edges:
                next_node = self.edges[current_node]
            else:
                next_node = END
                
            current_node = next_node

        if steps >= max_steps:
            logger.warning(f"[Graph] Terminated early due to max_steps ({max_steps})")
            
        return state
