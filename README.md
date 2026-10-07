# 附近加油站 · 燃油价格地图

本机地址：[http://localhost:5190](http://localhost:5190)。项目保存在 **F:\LocalSites\fuel-radar**，与原来的超市网站相互独立，可以同时运行。

## 使用

1. 安装 [Node.js](https://nodejs.org/) 22 或更高版本。本项目不需要安装第三方依赖。
2. 双击“启动网站.cmd”，或在 PowerShell 中运行 `& 'F:\LocalSites\fuel-radar\Start-Website.ps1'`。
3. 输入城市名或邮编（例如 `Helsinki`、`00100`），也可以使用浏览器定位或直接点选地图。
4. 选择 1、3、5、10、20、50 km 范围，查看附近加油站；列表按直线距离排序。
5. 选择加油站查看价格接入状态和官网入口；点击“导航”进入 Google Maps 路线导航。下方独立展示芬兰全国燃油月平均价。
6. 用“停止网站.cmd”停止服务器。

界面支持 English、中文和 Suomi，语言选择保存在浏览器中。电脑重启后需要再次启动网站。

## 价格数据及准确性

价格来自芬兰统计局（Statistics Finland）官方 PxWeb 表格：[Average prices of liquid fuels, monthly data](https://statfin.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__khi/11xx.px/)。程序通过官方 PxWeb API 获取最新月份的汽油 95 E10、汽油 98 E5、柴油、轻质燃油、压缩沼气及液化沼气平均价格。

这些数字是芬兰全国月平均价，不是实时价格，也不是所选加油站的泵价。消费者价格包含增值税；统计局说明沼气价格属于含增值税的企业价格，并且基于一家公司的数据。网站不会把全国均价冒充为具体门店价格。

服务器运行时每 12 小时检查一次官方数据。统计局通常按月发布新值，因此半日检查不代表价格每半日变化。页面同时显示本机检查时间、官方数据月份和官方数据集更新时间。电脑关机、休眠或无网络时无法检查。

具体加油站泵价尚未接入，页面会明确显示这一状态。要完成站点价格比较，需要提供可合法使用、包含站点及燃油类型、单位、价格和观测时间的数据源/API。当前没有使用未获准的加油站价格爬虫，不能用全国均价替代站点报价。

统计局公开数据依据 [CC BY 4.0 使用条款](https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use)使用；页面注明 Statistics Finland 来源，并将原始燃油类别名称翻译为三语。

## 加油站与地图

- OpenStreetMap 模式使用 Overpass 查询 `amenity=fuel`，查询包含道路和船用等被标记为燃油站的地点。主服务不可用时尝试 Private.coffee；请求按顺序发送，缓存 30 分钟，并在失败时明确提示。全国均价是独立参考，不与某个站点绑定。
- Google Maps 模式使用 Places API (New) 的 `gas_station` 类型，单次最多返回 20 个地点，所以不能保证列出范围内全部加油站。
- 距离为直线距离。加油站可能缺失、关闭或坐标不准确，取决于地图供应商的数据。
- Google Maps 导航按加油站坐标打开，无需额外导航 API 密钥。

城市、邮编和地图位置会发送给所选地图服务。OpenStreetMap 备用模式使用 Nominatim 搜索城市、Overpass 查询加油站；服务器不保存定位历史文件。

## Google 地图配置

打开网站右上角“地图设置”，在当前项目中单独填写 Google Maps API 密钥。原超市项目的本地密钥没有复制到这里。

测试可使用 Google 的 [Maps Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key)。长期使用时应在 Google Cloud 开启计费、Maps JavaScript API 和 Places API (New)，并把密钥的网站限制设置为 `http://localhost:5190/*` 与 `http://127.0.0.1:5190/*`。

密钥只保存在 `config/google-maps.local.json`，该文件已排除版本控制。空白格式见 `config/google-maps.example.json`。

## 本地文件

- 官方均价缓存：`data/prices.json`
- 更新记录：`data/updates.log`
- 服务日志：`data/server-output.log`、`data/server-error.log`
- 验证截图：`outputs/`

这些运行数据、截图和本地密钥不会加入 Git。项目只允许本机访问；GitHub 仓库用于保存源码，上传源码不会自动公开部署网站。

## 开发验证

运行 `npm test`，或直接运行 `node --test tests/*.test.mjs`。测试涵盖半径和坐标边界、加油站距离筛选、芬兰覆盖识别、Google 结果规范化、官方 JSON-stat2 燃油数据解析，以及三语翻译完整性。无需 npm 的手动更新命令为 `node update-prices.mjs`。

Leaflet 使用 BSD-2-Clause 许可证，见 `public/vendor/leaflet-LICENSE.txt`。
