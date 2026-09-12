# 新闻动态的内容边界

一条一个 JSON 文件，文件名 `YYYY-MM-DD-slug.json`。

## 什么该放这里

面向**外部读者**的内容：新的工作、发布、论文、合作计划。读者来这里是想知道
我们做出了什么，不是想知道我们内部发生了什么。

## 什么不该放

站务和内部动态。2026-08-04 曾有一篇《官网首页围绕 AI for Science 重构》，
2026-09-12 移除——官网改版是我们自己的事，对外部读者没有信息量。需要找回：

    git log --oneline -- src/_data/news/2026-08-04-homepage-rebuild.json
    git checkout <提交> -- src/_data/news/2026-08-04-homepage-rebuild.json

另有一份副本在 `D:\PhAILab\老首页备份-20260911\源码\`。

## draft 标记

`"draft": true` 的条目在 `HIDE_DRAFTS=1` 构建（即 `pnpm deploy`）时不生成页面、
也不进列表。本地构建仍可见，用于预览未发布内容——但这会让本地和线上不一致，
用完记得清掉。
