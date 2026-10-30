import DefaultTheme from 'vitepress/theme'
import PluginStore from './components/PluginStore.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PluginStore', PluginStore)
  },
}
