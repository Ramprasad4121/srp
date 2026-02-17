from setuptools import setup, find_packages

setup(
    name="srp",
    version="0.1.0",
    description="Security Reasoning Protocol — Verifiable, Policy-Bound Security Analysis",
    long_description=open("README.md").read(),
    author="Ramprasad",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "click>=8.0",
        "rich>=13.0",
        "requests>=2.31",
    ],
    extras_require={
        "chain": ["web3>=6.0"],
        "ipfs": ["ipfshttpclient>=0.8"],
    },
    entry_points={
        "console_scripts": [
            "srp=cmd.srp:main",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Security",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3.10",
    ],
)
