# AVBotz Software Docs

The source of **https://sw.avbotz.com**: AVBotz's software documentation, and the diagrams in it.

Every push to `main` builds the website and publishes it.

## Setup

Install [mise](https://mise.jdx.dev/getting-started.html), then in this directory:

```sh
mise trust && mise install
mise run dev                 # preview at http://localhost:4321; it reloads as you edit a page
```

## Tasks

```sh
mise run dev      # preview the website
mise run build    # build the website into dist/, failing on any broken internal link
mise run fmt      # format every .d2, Markdown and config file
mise run check    # check formatting
mise run diagrams # render every diagram into public/diagrams/
mise run watch diagrams/thalassic/vehicle-ros-graph.d2  # live preview of one diagram
```

CI runs `check` and `build` on every pull request, so run `mise run fmt` before you push.

## Pages

The website is [Starlight](https://starlight.astro.build). A page is a Markdown file in `src/content/docs/`, and its path is its URL: `src/content/docs/thalassic/control.md` is `/thalassic/control/`.

| Folder | What goes there |
| --- | --- |
| `start-here/` | The path for someone who has just joined, in order |
| `tutorials/` | Exercises that end with something working |
| `concepts/` | The ideas behind the code, explained from the start |
| `help/` | Troubleshooting and the glossary |
| `thalassic/` | The detailed reference for the [thalassic](https://github.com/avbotz/thalassic) repository |
| `diagrams/` | The diagrams page |

- A page starts with a `title` and a `description`, and the title is not repeated as a heading.
- A new page also has to go in the `sidebar` in `astro.config.mjs`.
- Link to another page by its URL, starting with a slash: `[Safety](/thalassic/control/#safety)`.
- Callouts are written like this, with the blank lines, or `mise run fmt` joins them into one paragraph:

  ```md
  :::note

  Text.

  :::
  ```

- Keep the beginner pages honest: run a command before you write down what it prints, and paste what it really printed.

## Diagrams

Diagrams are written in [D2](https://d2lang.com), and live in `diagrams/`. Each one is rendered when the website is built, at the same path under `/diagrams/`: `diagrams/thalassic/deployment.d2` is `/diagrams/thalassic/deployment.svg`. The diagrams page lists them all by itself.

To show one on a page, with a link to the full-size version:

```md
[![What the diagram shows.](/diagrams/thalassic/deployment.svg)](/diagrams/thalassic/deployment.svg)
```

- One directory per repository (`thalassic/`, …). A diagram is `<name>.d2`.
- Every diagram starts with `...@../_config` (with as many `../` as it is deep). Files whose names start with `_` are imports and are not rendered.
- The diagrams page takes a diagram's name from the `# ...` line of its `title: |md` block, or else from its file name.
- Avoid duplication. Put common code into a separate file that is then imported.
- Avoid explicit colours. A render switches to its dark theme with the viewer's browser, and colours set in D2 don't switch with it.
- A docs column is narrow: lay long chains out top-down.
