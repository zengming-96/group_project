-- 题目分类（行测模块）：与业务约定一致
COMMENT ON COLUMN question_details.question_type IS '1=言语判断 2=数量关系 3=判断推理 4=资料分析 5=常识判断';
COMMENT ON COLUMN exam_type_stats.question_type IS '与 question_details.question_type 相同枚举';
