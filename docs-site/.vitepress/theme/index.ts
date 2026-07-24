// SPDX-License-Identifier: EPL-2.0
import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import './custom.css';
import Playground from './Playground.vue';
import GoldenGallery from './GoldenGallery.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Playground', Playground);
    app.component('GoldenGallery', GoldenGallery);
  },
} satisfies Theme;
