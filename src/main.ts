import { createApp } from "vue";
import "./assets/styles/index.scss";
import App from "./App.vue";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import React from "react";
import { createRoot } from "react-dom/client";
import { ThinkingOrb } from "thinking-orbs";

gsap.registerPlugin(ScrollTrigger);

createApp(App).mount("#app");

const preloaderReactRoot = document.getElementById("preloader-react-root");
if (preloaderReactRoot) {
  const root = createRoot(preloaderReactRoot);
  root.render(React.createElement(ThinkingOrb, { state: "searching", size: 64 }));
}
