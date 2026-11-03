// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

export default defineConfig({
  site: "https://sw.avbotz.com",
  // Pages that were merged into others.
  redirects: {
    "/thalassic/sub-mission": "/thalassic/mission/",
    "/thalassic/sub-vision": "/thalassic/vision/",
    "/thalassic/jetson-os": "/thalassic/deployment/#what-deployjetsonsetupsh-does",
    "/thalassic/udev": "/thalassic/deployment/#udev-rules",
  },
  integrations: [
    starlight({
      title: "AVBotz Software",
      description:
        "How the software on AVBotz's underwater robot works, and how to start working on it.",
      favicon: "/favicon.ico",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/avbotz" }],
      editLink: { baseUrl: "https://github.com/avbotz/software-docs/edit/main/" },
      lastUpdated: true,
      customCss: ["./src/styles/custom.css"],
      // The website's build fails on a link to a page or heading that does not exist.
      plugins: [starlightLinksValidator({ exclude: ["/diagrams/**"] })],
      sidebar: [
        {
          label: "Start here",
          items: [
            "start-here",
            "start-here/big-picture",
            "start-here/what-to-learn",
            "start-here/setup",
            "start-here/run-the-simulator",
            "start-here/ros-2-hands-on",
            "start-here/code-tour",
            "start-here/pick-an-area",
          ],
        },
        {
          label: "Your first contributions",
          items: [
            "tutorials/first-mission",
            "tutorials/first-node",
            "tutorials/first-cpp-change",
            "tutorials/first-pull-request",
          ],
        },
        {
          label: "Concepts",
          items: [
            "concepts/coordinates",
            "concepts/sensors",
            "concepts/control",
            "concepts/behavior-trees",
            "concepts/vision",
            "concepts/build-tools",
          ],
        },
        {
          label: "Help",
          items: ["help/troubleshooting", "help/glossary"],
        },
        {
          label: "Thalassic reference",
          collapsed: true,
          items: [
            { label: "Overview", slug: "thalassic" },
            "thalassic/setup",
            "thalassic/architecture",
            "thalassic/control",
            "thalassic/mission",
            "thalassic/vision",
            "thalassic/foxglove",
            "thalassic/simulation",
            "thalassic/recording",
            "thalassic/networking",
            "thalassic/deployment",
            "thalassic/decisions",
          ],
        },
        { label: "Diagrams", link: "/diagrams/" },
      ],
    }),
  ],
});
