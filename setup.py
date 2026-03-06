from setuptools import find_packages, setup


setup(
    name="srp-protocol",
    version="0.1.0",
    description="Security Reasoning Protocol",
    packages=find_packages(),
    py_modules=["srp"],
    python_requires=">=3.10",
    install_requires=[
        "fastapi",
        "uvicorn",
        "anthropic",
        "openai",
        "web3",
        "python-dotenv",
        "aiohttp",
        "pydantic",
        "rich",
        "click",
        "networkx",
    ],
    entry_points={
        "console_scripts": [
            "srp=srp:cli",
        ],
    },
)
