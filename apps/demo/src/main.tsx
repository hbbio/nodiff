import { mount } from "@nodiffjs/core";
import { App, router } from "./app";
import "./styles.css";

router.start();
mount("#app", App);
