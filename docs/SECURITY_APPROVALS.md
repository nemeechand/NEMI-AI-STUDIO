# SECURITY_APPROVALS.md

## Permanent Safe Approvals

Claude may automatically execute the following commands without asking for approval.

These commands are considered SAFE because they only inspect, validate, install dependencies, or build the project.

### Git

git status

git diff

git diff --stat

git log

git branch

git show

git rev-parse

git ls-files

git add .

git commit

### Node

npm install

npm ci

npm run dev

npm run build

npm run lint

npm run format

npm test

npx tsc

npx vite

### Python

python -m venv

pip install

pytest

ruff check

mypy

python app/main.py

### Electron

electron

electron-builder

vite build

### Read-only Commands

dir

ls

tree

find

findstr

type

cat

pwd

cd

echo

where

which

### Allowed File Operations

Create files

Modify project files

Rename project files

Create folders

Update package.json

Update pyproject.toml

Update README

Update PROJECT_MEMORY.md

Update documentation

Update configuration files

### Never Ask Again For

Project validation

Type checking

Linting

Formatting

Dependency installation

Project build

Documentation updates

Git status

Git commit

Folder creation

File creation

Project scaffolding

--------------------------------------------------

## Dangerous Commands

Always ask before executing these.

rm -rf

del /s

format

diskpart

shutdown

taskkill

git reset --hard

git clean -fd

git push --force

git rebase

registry editing

system configuration

deleting databases

deleting user files

network security changes

--------------------------------------------------

Rule:

If a command appears in the Safe list,
execute automatically.

If a command appears in Dangerous,
always request approval.

If unsure,
ask first.