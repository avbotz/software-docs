---
title: Your first pull request
description: How we use git and GitHub. Make a change on a branch, commit it, push it, open a pull request and get it reviewed.
---

A **pull request** (PR) is how a change gets into the team's code. You make it on your own branch, then ask the team to review and merge it.

Make your first one a **fix to these docs**: something confusing, wrong or misspelled.

## Before you start

1. **Make a GitHub account**, if you don't have one, and ask a software lead to add you to the [avbotz](https://github.com/avbotz) organization. You need that to push branches.
1. **Tell git who you are:**

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

1. **Set up an SSH key,** so GitHub knows it's you. Follow [GitHub's guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh). Check it with `ssh -T git@github.com`.
1. **Get the repository.** For the docs:

   ```bash
   cd ~/avbotz
   git clone git@github.com:avbotz/software-docs.git
   ```

   For Thalassic, which you cloned earlier with an `https://` address, switch it to SSH so you can push:

   ```bash
   cd ~/avbotz/thalassic
   git remote set-url origin git@github.com:avbotz/thalassic.git
   ```

## The flow

The steps are the same for every repository.

### 1. Start from the latest `main`

```bash
git switch main
git pull
```

`main` is the team's official version. Nobody commits to it directly.

### 2. Make a branch

A **branch** is your own line of work, separate from everyone else's. Name it after what you are doing:

```bash
git switch -c fix-setup-typo
```

### 3. Make your change

To preview a docs change, run this in `software-docs` and open `http://localhost:4321` in your browser:

```bash
mise trust && mise install
mise run dev
```

For code, build and test it the way you did in [the C++ tutorial](/tutorials/first-cpp-change/).

### 4. See what you changed

```bash
git status
git diff
```

Read your diff before you commit: it catches mistakes like leftover debugging prints.

### 5. Commit

A **commit** is a saved snapshot, with a message saying what changed:

```bash
git add src/content/docs/start-here/setup.md
git commit -m "docs: fix a typo in the setup page"
```

Commit messages look like `type(area): what changed`, in lower case. From our history:

```text
feat(sub_vision): remove tensorrt and run all inference with onnxruntime and different EPs
fix(sub_mission): ensure gate missions can be edited and loaded properly
ci: ensure x64 runners don't use arm caches
build: improve management of pixi environments
docs: update docs
refactor: reduce unnecessary code
```

| Type       | For                                                         |
| ---------- | ----------------------------------------------------------- |
| `feat`     | A new feature                                               |
| `fix`      | A bug fix                                                   |
| `docs`     | Documentation only                                          |
| `refactor` | Changing how code is written, without changing what it does |
| `build`    | Dependencies and the build system                           |
| `ci`       | Automated checks                                            |

The `(area)` is usually the package. The summary says _what_ changed; if the reason isn't obvious, the body says _why_.

#### If the commit is rejected

In Thalassic, **git hooks** check formatting when you commit. If one fails, the commit doesn't happen:

```text
clang-format.............................................................Failed
- hook id: clang-format
- exit code: 1

src/sub_mission/src/nodes/actions/say.cpp:1:4: error: code should be clang-formatted
```

Run the formatter, add what it changed, and commit again:

```bash
pixi run format
git add -u
git commit -m "..."
```

In `software-docs`, `mise run fmt` does the same job.

### 6. Push

Send your branch to GitHub:

```bash
git push -u origin fix-setup-typo
```

The output includes a link for creating a pull request.

### 7. Open the pull request

Open that link, or go to the repository on GitHub and press **Compare & pull request**. Then:

- **The title** is like a commit message: `docs: fix a typo in the setup page`.
- **The description** says what you changed and why, and how you tested it. "I ran it in the simulator with `mission:=pid_tuning` and it still finishes" is more useful than "tested".
- **If you changed a mission, the controller or anything else that affects how the robot moves,** say what you saw in the simulator.

Ask a software lead to review it.

### 8. Wait for the checks

**CI** (Continuous Integration) checks every pull request on GitHub's computers. In Thalassic it checks formatting, builds everything and runs every test, including a run of the whole stack in the simulator, on four machine types, which takes a while. The docs' checks are quick: formatting, the build, and every link between pages.

If a check fails, click **Details** and find the first error in the log. Fix it, commit and push again; the pull request updates and CI runs again.

### 9. Respond to the review

Make the requested changes, commit and push to the same branch. If you disagree with a comment, or don't understand it, say so in a reply.

### 10. Merge

Once it's approved and the checks pass, it gets merged. Then tidy up your copy:

```bash
git switch main
git pull
git branch -d fix-setup-typo
```

## Good habits

- **Keep pull requests small,** one change each. Small ones get reviewed quickly and well.
- **Group your commits sensibly:** a handful that each make sense by themselves, not one per small fix.
- **Test before you ask for review.** At a minimum, it should build and `pixi run lint` should pass. If you changed behavior, run it in the simulator.
- **Update the docs** in this website when your change makes them wrong.

## Things to avoid

- **Don't commit directly to `main`.**
- **Don't commit large or generated files:** model weights, bags, `build/`, `install/`, `.pixi/`. Most are already ignored.
- **Don't edit `pixi.lock` by hand.** `pixi add` updates it. Commit it together with `pixi.toml`. See [Updating dependencies](/thalassic/setup/#updating-dependencies).
- **Don't use `git commit --no-verify`** just to get past a hook. CI fails on the same check anyway.
- **Don't force-push a branch someone else is working on,** or one that's under review, without asking.
- **Don't use `git add .` without checking `git status` first.** It's an easy way to commit something by accident.

## If you get stuck with git

Nearly everything in git can be undone. Before anything drastic, like deleting your folder, ask someone and show them `git status`.

After the tutorials, [pick an area](/start-here/pick-an-area/) and ask for your first real task.
