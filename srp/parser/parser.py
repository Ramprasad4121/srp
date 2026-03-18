"""
SRP Project Parser
Multi-contract Solidity parser for SRP Phase 1
"""

import os
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Contract:
    name: str
    file_path: str
    functions: List[Dict[str, Any]]
    state_variables: List[Dict[str, Any]]
    inherits: List[str]
    imports: List[str]

@dataclass
class Function:
    name: str
    contract: str
    visibility: str
    parameters: List[str]
    returns: List[str]
    modifiers: List[str]
    modifiers: List[str]

@dataclass
class StateVariable:
    name: str
    contract: str
    type: str
    visibility: str

class ProjectData:
    def __init__(self):
        self.contracts: List[Contract] = []
        self.functions: List[Function] = []
        self.state_variables: List[StateVariable] = []
        self.relationships: List[Dict[str, Any]] = []

class SolidityParser:
    """Solidity parser for SRP Phase 1"""

    def __init__(self):
        self.contract_regex = re.compile(r'contract\s+(\w+)\s*(:\s*\w+)*\s*\{')
        self.function_regex = re.compile(r'(public|private|internal|external|pure|view|payable)\s+(\w+)\s*(\([^)]*\))?\s*(constant|pure|view|payable)?\s*(returns\s*\([^)]*\))?')
        self.state_var_regex = re.compile(r'(public|private|internal|external)\s+(\w+)\s+(\w+)\s*(\w+)?')
        self.import_regex = re.compile(r'import\s+["']([^"']+)')
        self.inherit_regex = re.compile(r':\s*(\w+(,\s*\w+)*)')

    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """Parse a single Solidity file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract contract
        contracts = []
        contract_matches = self.contract_regex.finditer(content)
        for match in contract_matches:
            contract_name = match.group(1)
            inherits_match = self.inherit_regex.search(match.group(0))
            inherits = [i.strip() for i in inherits_match.group(1).split(',')] if inherits_match else []

            # Extract functions
            functions = self._extract_functions(content, contract_name)

            # Extract state variables
            state_vars = self._extract_state_vars(content, contract_name)

            # Extract imports
            imports = self._extract_imports(content)

            contracts.append({
                'name': contract_name,
                'file_path': file_path,
                'functions': functions,
                'state_variables': state_vars,
                'inherits': inherits,
                'imports': imports
            })

        return contracts

    def _extract_functions(self, content: str, contract_name: str) -> List[Dict[str, Any]]:
        """Extract functions from contract content"""
        functions = []

        # Find all function definitions
        func_matches = re.finditer(r'(public|private|internal|external|pure|view|payable)\s+(\w+)\s*(\([^)]*\))?\s*(constant|pure|view|payable)?\s*(returns\s*\([^)]*\))?', content)

        for match in func_matches:
            visibility = match.group(1)
            func_name = match.group(2)
            params = match.group(3) if match.group(3) else ""
            modifiers = [m for m in [match.group(4), match.group(5)] if m]

            functions.append({
                'name': func_name,
                'contract': contract_name,
                'visibility': visibility,
                'parameters': self._parse_params(params),
                'modifiers': modifiers,
                'returns': []
            })

        return functions

    def _extract_state_vars(self, content: str, contract_name: str) -> List[Dict[str, Any]]:
        """Extract state variables from contract content"""
        state_vars = []

        # Find all state variable declarations
        var_matches = re.finditer(r'(public|private|internal|external)\s+(\w+)\s+(\w+)(\s*\[\s*\d*\s*\])?\s*(\w+)?', content)

        for match in var_matches:
            visibility = match.group(1)
            var_type = match.group(2)
            var_name = match.group(3)

            state_vars.append({
                'name': var_name,
                'contract': contract_name,
                'type': var_type,
                'visibility': visibility
            })

        return state_vars

    def _extract_imports(self, content: str) -> List[str]:
        """Extract import statements"""
        imports = []
        import_matches = self.import_regex.finditer(content)

        for match in import_matches:
            imports.append(match.group(1))

        return imports

    def _parse_params(self, params_str: str) -> List[str]:
        """Parse function parameters"""
        if not params_str or params_str == "()":
            return []

        # Remove parentheses and split
        params_str = params_str.strip('()')
        params = []

        for param in params_str.split(','):
            param = param.strip()
            if param:
                params.append(param)

        return params


def parse_project(project_path: str) -> ProjectData:
    """
    Parse a complete Solidity project

    Args:
        project_path: Path to the project root

    Returns:
        ProjectData object with all parsed information
    """
    parser = SolidityParser()
    project_data = ProjectData()

    # Walk through all .sol files
    for root, dirs, files in os.walk(project_path):
        for file in files:
            if file.endswith('.sol'):
                file_path = os.path.join(root, file)

                # Parse the file
                contracts = parser.parse_file(file_path)

                for contract in contracts:
                    # Add contract
                    project_data.contracts.append(contract)

                    # Add functions
                    for func in contract['functions']:
                        project_data.functions.append(func)

                    # Add state variables
                    for var in contract['state_variables']:
                        project_data.state_variables.append(var)

                    # Add relationships (inheritance)
                    for inherit in contract['inherits']:
                        project_data.relationships.append({
                            'type': 'INHERITS',
                            'from': contract['name'],
                            'to': inherit
                        })

    return project_data