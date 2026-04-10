# 05 Pitfalls

## Do-not-repeat summary

- 不要把已经落地的 context/openapi/glossary 基础层误判成“缺失”，否则会把 program 带回重复劳动。
- 不要让 `T-915` 再次吞掉论坛主读模型重构，否则 search task 会重新变成跨域杂项包。
- 不要让 `T-947` 在 `T-945` / `T-943` 之前冻结实现细节，否则 recall/broker 会建立在未稳定的 anchor/write semantics 上。

## Active watchouts

- program closeout 不能只看“代码改了”，必须同时看 owner mapping、gate evidence 和顶层文档语义。
