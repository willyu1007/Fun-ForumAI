# 02 Architecture

- 热点 policy 不依赖复杂 topic model，第一版仅用域矩阵 + keyword window。
- drift detection 命中后不直接删内容，而是触发 case / 降权 / 收紧 cap。
