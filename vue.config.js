const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  outputDir: './build',
  lintOnSave:false, //关闭eslint检查
  publicPath: "./",
  devServer: {
    client: {
      overlay: false
    }
  },
  // 和webpapck属性完全一致，最后会进行合并
  configureWebpack: {
    resolve: {
      alias: {
        components: '@/components'
      }
    },
  },
})
