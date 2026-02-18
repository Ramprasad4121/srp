from setuptools import setup, find_packages

setup(
    name="srp",
    version="0.1.0",
    description="Security Reasoning Protocol",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=["click>=8.0", "rich>=13.0", "requests>=2.31"],
    entry_points={
        "console_scripts": [
            "srp=srp_pkg.main:main",
        ],
    },
)
