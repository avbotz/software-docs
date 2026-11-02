---
title: Your first pull request
description: How we use git and GitHub. Make a change on a branch, commit it, push it, open a pull request and get it reviewed.
---

A **pull request** (PR) is how a change gets into the team's code. You make your change on your own branch, then ask the team to review it and merge it in. This page walks you through it.

We suggest that your first one is a **fix to these docs**. Find something confusing, wrong or misspelled, and fix it. It's useful, it's low risk, and new members are the best at finding these problems.

## Before you start

1. **Make a GitHub account**, if you don't have one, and ask a software lead to add you to the [avbotz](https://github.com/avbotz) organization. You need that to push branches.
1. **Tell git who you are:**

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

1. **Set up an SSH key,** so that GitHub knows it's you. Follow [GitHub's guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh). Check it with `ssh -T git@github.com`.
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

Edit the files. To preview a docs change, run this in `software-docs`, and open `http://localhost:4321` in your browser:

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

Read your own diff before anything else. You will catch more mistakes this way than you would expect, like leftover debugging prints.

### 5. Commit

A **commit** is a saved snapshot, with a message saying what changed:

```bash
git add src/content/docs/start-here/setup.md
git commit -m "docs: fix a typo in the setup page"
```

**Our commit messages** look like `type(area): what changed`, in lower case. Here are real ones from our history:

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

The `(area)` is usually the package. Say _what_ changed in the summary, and if the reason isn't obvious, explain _why_ in the body of the message. People will read this years from now, when they wonder why the code is the way it is.

### If the commit is rejected

In Thalassic, **git hooks** check your formatting when you commit. If one fails, your commit doesn't happen, and you will see something like this:

```text
clang-format.............................................................Failed
- hook id: clang-format
- exit code: 1

src/sub_mission/src/nodes/actions/say.cpp:1:4: error: code should be clang-formatted
```

This is fine, and it happens to everyone. It means that you run the formatter, add what it changed, and commit again:

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
- **The description** says what you changed and why, and how you tested it. A reviewer has less context than you do. "I ran it in the simulator with `mission:=pid_tuning` and it still finishes" is much more useful than "tested".
- **If you changed a mission, the controller or anything else that affects how the robot moves,** say what you saw in the simulator.

Ask a software lead to review it.

### 8. Wait for the checks

**CI** (Continuous Integration) automatically checks every pull request on GitHub's computers. In Thalassic, it checks the formatting, builds everything and runs every test, including a run of the whole stack in the simulator, on four different machine types. That takes a while. The docs' checks are quick, and include checking that every link on the website works.

If a check fails, click **Details** to see why. Scroll to the first error in the log, fix it, commit and push again. The pull request updates by itself, and CI runs again.

### 9. Respond to the review

A reviewer will probably ask for changes. **This is normal, and it isn't a criticism of you.** Everyone gets review comments, including the people who have been here for years. It's how the team learns from each other, and you will pick up a lot this way.

Make the changes, commit and push to the same branch. If you disagree with a comment, or don't understand it, say so. That's part of the conversation too.

### 10. Merge

Once it's approved and the checks pass, it gets merged. Your code is now part of the robot's software. Tidy up your copy:

```bash
git switch main
git pull
git branch -d fix-setup-typo
```

## Good habits

- **Keep pull requests small.** One change at a time. Small ones get reviewed quickly and are easy to understand. A week's work in one pull request is hard to review well.
- **Group your commits sensibly.** A branch should be a handful of commits that each make sense by themselves, not one for every small fix along the way.
- **Test before you ask for review.** At a minimum, it should build and `pixi run lint` should pass. If you changed behavior, run it in the simulator.
- **Update the docs** in this website when your change makes them wrong.

## Things to avoid

- **Don't commit directly to `main`.**
- **Don't commit large or generated files.** That means model weights, bags, and `build/`, `install/` and `.pixi/`. Most are already ignored.
- **Don't edit `pixi.lock` by hand.** `pixi add` updates it. Commit it together with `pixi.toml`. See [Updating dependencies](/thalassic/setup/#updating-dependencies).
- **Don't use `git commit --no-verify`** just to get past a hook. CI will fail on the same check anyway.
- **Don't force-push a branch someone else is working on,** or one that's under review, without asking.
- **Don't use `git add .` without checking `git status` first.** It's an easy way to commit something by accident.

## If you get stuck with git

Git is confusing for everyone at first, and nearly everything can be undone. Before you try anything drastic like deleting your folder, ask someone. Show them the output of `git status`, and they can usually sort it out in a minute.

That's the end of the tutorials! Now [pick an area](/start-here/pick-an-area/), and ask for your first real task.
