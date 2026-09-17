# One-repo workflow (VIT Academic Monitoring Portal)

Use **one GitHub repo** and **one folder** on your PC. All real code lives on **`main`**.

Repo: https://github.com/Dnyaneshh18/Academic-Monitoring-Portal

## On your PC

```powershell
cd C:\Users\User\OneDrive\Attachments\Desktop\Personal_Projects\Academic-Monitoring-Portal
git checkout main
git pull origin main
```

After every Arena session that merges a PR, run `git pull origin main` in that same folder.

## After you change code

```powershell
git checkout -b feature/short-name
git add README.md src public package.json package-lock.json
git commit -m "What you changed"
git push -u origin feature/short-name
```

Then on GitHub: **Compare & pull request** → merge into **`main`**.

Do **not** `git add` `data/*.db`, `node_modules`, or `.env`.

## Arena

Each Arena chat uses a temporary `arena/…` branch. That is **not** a second project.

1. Ask the agent to commit **and push**, then open a PR to **`main`**.
2. Merge the PR.
3. On your PC: `git pull origin main`.
4. Extra `arena/…` branches can be deleted after merge.

If a chat says it **cannot push** (session closed), start a **new** Arena chat on the **same repo** and say: put the latest portal on this branch and merge to `main`.

## Check you have the latest

```powershell
git fetch origin
git log origin/main -1 --oneline
```
