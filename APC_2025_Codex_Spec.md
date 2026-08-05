# APC 2025 查询与出席管理系统 — Codex 实现规格

## 一、项目背景

为 **Majlis Anugerah Perkhidmatan Cemerlang (APC) 2025** 建立一个手机优先的查询与出席管理系统。

参与者扫描现场二维码后，可以使用姓名或身份证号码查询个人资料，并看到：

- 获奖者编号（Bil）
- 座位编号（No. Kerusi）
- 应前往的柜台（Kaunter）
- 所属单位／学校
- 出席确认状态

后台供文凭组、司仪组及管理员实时查看查询与出席情况，并可打印名单、筛选柜台、进行演练及重置演练记录。

---

## 二、现有 Excel 数据检查结果

来源文件：`PENERIMA APC 2025.xlsx`

- 总获奖者人数：**332 人**
- 编号：1–332，连续且无重复
- 座位编号：1–332，连续且无重复
- 柜台分配：
  - Kaunter 1：编号 1–57，共 57 人
  - Kaunter 2：编号 58–112，共 55 人
  - Kaunter 3：编号 113–167，共 55 人
  - Kaunter 4：编号 168–222，共 55 人
  - Kaunter 5：编号 223–277，共 55 人
  - Kaunter 6：编号 278–332，共 55 人
- 姓名、身份证号码、学校／单位、座位及柜台字段均完整
- 未发现重复姓名、重复身份证号码或重复座位编号
- 身份证号码栏目前混合了“数字”和“文字”格式：
  - 311 笔为数字
  - 21 笔为文字

### 数据导入时必须处理

1. 所有身份证号码统一转换为 **12 位纯文字字符串**，不可作为数字储存。
2. 移除空格和 `-`，但保留前导 0。
3. 姓名建立标准化字段：
   - 转大写
   - 去除首尾空格
   - 连续空格合并
   - 搜索时兼容 `'`、`@`、`A/P`、`A/L` 等写法
4. `bil`、`seat_no`、`counter_no` 建立唯一性验证。
5. 导入前显示验证报告；发现缺漏、重复或错误时，不允许直接上线。

---

## 三、最重要的业务逻辑修正

不要把“参与者曾经查询过”直接等同于“参与者已经出席”。

系统应至少区分以下状态：

1. **Belum Semak**
   - 尚未查询。

2. **Telah Semak**
   - 已经查询过座位和柜台资料。
   - 只能代表参与者打开过系统，不一定人在现场。

3. **Hadir Disahkan**
   - 参与者点击“确认出席”，或由工作人员后台确认。
   - 才能正式纳入出席统计。

建议后台同时显示：

- 总人数
- 已查询人数
- 已确认出席人数
- 未确认人数
- 各柜台已确认人数

---

## 四、用户角色

### 1. Public Participant

无需登录，只能：

- 查询自己的资料
- 查看编号、座位、柜台和所属单位
- 确认出席
- 查看确认成功状态

不得读取完整参与者名单。

### 2. Counter / Certificate Staff

登录后可以：

- 查看指定柜台名单
- 按编号顺序查看
- 手动确认／撤销某人的出席状态
- 搜索姓名或编号
- 查看最近确认出席者

### 3. Emcee / Secretariat

登录后可以：

- 查看全体实时出席情况
- 按编号、柜台、学校和状态筛选
- 查看已确认名单
- 打印名单
- 导出 CSV

### 4. Super Admin

可以：

- 导入或更新参与者资料
- 管理活动模式
- 建立演练场次
- 重置演练记录
- 管理后台用户
- 查看操作记录

---

## 五、公开查询页面

### 页面流程

1. 扫描二维码进入 `/semak`
2. 显示活动名称及简短说明
3. 输入姓名或 No. Kad Pengenalan
4. 选择搜索结果
5. 显示个人资料
6. 点击 `SAHKAN KEHADIRAN`
7. 显示确认成功

### 搜索输入规则

使用一个智能 Combobox：

- 输入英文字母：按姓名搜索
- 输入数字：按身份证号码搜索

#### 姓名搜索

- 至少输入 3 个字符才开始查询
- 250–350ms debounce
- 最多显示 8 个结果
- 结果显示：
  - 姓名
  - 学校／单位
  - 已遮盖身份证号码最后 4 位
- 高亮匹配文字
- 支持键盘上下键和 Enter
- 兼容手机触控

#### 身份证号码搜索

为保护个人资料：

- 不允许公开列出相近身份证号码
- 输入未满 12 位时只显示提示
- 输入完整 12 位后进行精确匹配
- 不在前端返回完整身份证号码
- 结果只显示遮盖格式，例如：`******-**-5649`

### 无结果状态

显示：

> Rekod tidak ditemui.  
> Sila semak ejaan nama atau nombor Kad Pengenalan anda.  
> Jika masih tidak berjaya, sila hubungi Urus Setia.

提供 `CUBA SEMULA` 按钮。

---

## 六、查询结果卡片

查询成功后显示：

- `TAHNIAH`
- 姓名
- 学校／单位
- `No. Penerima / Bil`
- `No. Kerusi`
- `Kaunter`
- 明确指示：
  - `Sila hadir ke Kaunter 1`
- `SAHKAN KEHADIRAN` 主按钮

确认后：

- 按钮变为 `KEHADIRAN TELAH DISAHKAN`
- 显示确认时间
- 显示绿色成功图标
- 不允许重复建立多笔出席记录

同一参与者再次进入时，应直接显示已确认状态。

---

## 七、演练与正式场次

不要只依靠“清空所有记录”。

建立活动 Session：

- `LATIHAN 1`
- `LATIHAN 2`
- `SESI SEBENAR`

每一笔查询和出席记录都必须属于一个 Session。

后台顶部必须清楚显示当前模式：

- 黄色：`MOD LATIHAN`
- 红色或金色：`SESI SEBENAR`

正式活动启用后，演练数据不会混入正式统计。

### 重置功能

仅 Super Admin 可执行。

流程：

1. 点击 `Reset Rekod Latihan`
2. 再次输入管理员密码
3. 输入确认文字：`RESET APC 2025`
4. 显示将被重置的 Session 和记录数量
5. 先自动建立备份
6. 执行软删除或归档
7. 写入 Audit Log

禁止在前端代码中写死密码。

---

## 八、后台 Dashboard

建议路由：

- `/admin/dashboard`
- `/admin/kaunter/1`
- `/admin/kaunter/2`
- `/admin/kaunter/3`
- `/admin/kaunter/4`
- `/admin/kaunter/5`
- `/admin/kaunter/6`
- `/admin/print`
- `/admin/settings`

### Dashboard KPI

- Jumlah Penerima：332
- Telah Semak
- Hadir Disahkan
- Belum Hadir
- Peratus Kehadiran
- 最近 10 位确认者
- 各柜台进度

### 名单表格

默认按 `Bil` 升序。

字段：

- Bil
- Nama
- Sekolah / Unit
- No. Kerusi
- Kaunter
- Status Semakan
- Status Kehadiran
- Masa Semakan Pertama
- Masa Kehadiran
- Tindakan

筛选：

- 全部／已查询／已确认／未确认
- 柜台 1–6
- 学校／单位
- 编号范围
- 姓名

### 实时更新

优先使用 Supabase Realtime。

若 Realtime 不稳定，使用 10 秒轮询作为 fallback。

页面必须显示：

- 最后更新时间
- 在线／离线状态
- 手动刷新按钮

---

## 九、打印与导出

打印页必须使用专门的 Print CSS，A4 纵向。

可选择：

- 所有参与者
- 已确认出席者
- 已查询但未确认者
- 未出席者
- 指定柜台
- 指定学校／单位

打印字段：

- Bil
- Nama
- Sekolah / Unit
- No. Kerusi
- Kaunter
- Masa Kehadiran
- Tandatangan（可选空白栏）

页眉：

- 活动名称
- Session
- 日期
- 打印时间
- 筛选条件
- 总人数

页脚：

- 页码
- `Dicetak pada ...`

同时提供：

- `CETAK`
- `SIMPAN PDF`
- `EKSPORT CSV`

---

## 十、数据库设计建议

### participants

- `id` UUID
- `bil` integer unique
- `name` text
- `name_normalized` text indexed
- `ic_hash` text unique
- `ic_last4` text
- `organization` text
- `seat_no` integer unique
- `counter_no` integer
- `created_at`
- `updated_at`

不要让公开客户端直接读取完整身份证号码。

### event_sessions

- `id`
- `name`
- `mode`：rehearsal / live
- `is_active`
- `starts_at`
- `ends_at`
- `created_by`

### participant_activity

- `id`
- `participant_id`
- `session_id`
- `first_lookup_at`
- `last_lookup_at`
- `lookup_count`
- `attendance_status`
- `attendance_confirmed_at`
- `confirmation_source`：participant / staff
- `confirmed_by`
- `updated_at`

每位参与者在每个 Session 只能有一笔 activity 记录：

`UNIQUE(participant_id, session_id)`

### audit_logs

- `id`
- `user_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

---

## 十一、安全与隐私

1. 公开页面不可直接下载整张参与者表。
2. 不可在浏览器 JavaScript bundle 内嵌完整身份证号码。
3. 身份证号码使用服务器端精确匹配。
4. API 加入 rate limit。
5. 后台使用 Supabase Auth 或正式登录机制。
6. 重置和导入操作必须再次验证身份。
7. Supabase 启用 Row Level Security。
8. 完整身份证号码不显示在公开结果、后台普通表格或打印名单。
9. 所有时间统一使用 `Asia/Kuala_Lumpur`。
10. 记录管理员的重置、手动确认和撤销操作。

---

## 十二、重复操作与异常处理

- 重复查询：更新 `last_lookup_at` 和 `lookup_count`，不新增重复记录。
- 重复确认出席：保持同一笔记录，不重复计数。
- 工作人员撤销出席：必须填写原因并写入 Audit Log。
- 网络中断：显示清楚错误，不可假装成功。
- 提交按钮点击后立即 disabled，避免连点。
- API 失败时允许重试。
- Excel 更新后重新导入，必须先显示新增、修改、删除差异。
- 若同名人员未来出现，搜索结果必须用学校／单位及 IC 后 4 位区分。

---

## 十三、技术建议

建议技术栈：

- Next.js + TypeScript
- Tailwind CSS
- Supabase Database
- Supabase Auth
- Supabase Realtime
- Vercel
- Zod 做输入验证
- React Hook Form
- shadcn/ui Combobox 或 Headless UI Combobox

建议所有敏感查询通过：

- Next.js Server Actions
- 或 `/api/search` 服务器端 Route Handler

不要让公开页面直接使用 Supabase anon key 查询完整 participants 表。

---

## 十四、视觉设计方向

整体风格：

- 深海军蓝 `#08172F`
- 皇家蓝 `#102A54`
- 香槟金 `#D8B45A`
- 柔和象牙白 `#F7F3E8`
- 成功绿 `#1F8A5B`

视觉元素：

- 低调马来西亚 Songket 几何纹样
- 金色细线边框
- 柔和宴会灯光和散景
- 标题使用庄重 Serif 字体
- 正文使用清晰 Sans Serif
- 大号座位和柜台数字
- 不使用廉价渐变、过多发光或过多装饰

手机端必须：

- 单手操作
- 主按钮高度至少 48px
- 字体清楚
- 对比度足够
- 不需要左右缩放
- 结果页最重要的信息在首屏可见

---

## 十五、建议 UI 文案

### 首页

**MAJLIS ANUGERAH PERKHIDMATAN CEMERLANG 2025**

`Semak nombor penerima, tempat duduk dan kaunter anda.`

输入框：

`Masukkan nama atau No. Kad Pengenalan`

按钮：

`SEMAK MAKLUMAT`

### 查询成功

`TAHNIAH`

`Maklumat anda telah ditemui.`

- `No. Penerima`
- `No. Kerusi`
- `Kaunter`

提示：

`Sila hadir ke Kaunter {counter_no} untuk urusan penerimaan sijil.`

按钮：

`SAHKAN KEHADIRAN`

### 确认成功

`KEHADIRAN BERJAYA DISAHKAN`

`Terima kasih. Sila simpan paparan ini sebagai rujukan.`

---

## 十六、验收标准

1. 332 位参与者都能正确查询。
2. 姓名搜索不区分大小写。
3. 身份证号码只能精确匹配，且不泄露完整号码。
4. 座位、编号和柜台与 Excel 一致。
5. 查询不会重复增加人数。
6. 出席确认不会重复计数。
7. 后台统计与名单数量一致。
8. 后台名单默认按 Bil 排序。
9. 可按柜台和状态筛选。
10. 打印结果与当前筛选一致。
11. 演练和正式活动数据完全分开。
12. 重置前必须密码、确认文字及备份。
13. 手机端 Chrome、Safari 和 WhatsApp 内置浏览器可正常使用。
14. 网络错误时有明确反馈。
15. 公共用户无法取得完整参与者名单或身份证号码。
16. 所有后台关键操作都有 Audit Log。

---

## 十七、第一阶段交付顺序

1. 建立数据库及 Excel 导入脚本
2. 建立公开查询页面
3. 建立查询和确认出席 API
4. 建立后台 Dashboard
5. 建立柜台视图
6. 建立打印和 CSV 导出
7. 建立 Session、演练及重置功能
8. 加入权限、安全、Audit Log
9. 手机测试及现场网络测试
10. 上线前进行完整 332 人数据核对

请先输出：

1. 项目目录结构
2. 数据库 migration SQL
3. Excel 导入及验证逻辑
4. 页面与 API 路由设计
5. 实现步骤
6. 风险点
7. 然后再开始编写代码
