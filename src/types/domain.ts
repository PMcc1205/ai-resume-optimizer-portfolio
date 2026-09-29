import type { RequirementLevel } from '../constants/status'

export type TaskStep = 1 | 2 | 3 | 4 | 5 | 6
export type TaskInputState = { jobTitle: string; companyName: string; jobDescription: string; resumeText: string }
export type ResumeOptimizationTask = { taskId: string; jobTitle: string; companyName: string; rawJobDescription: string; currentStep: TaskStep; taskStatus: string; createdAt: string }
export type JobRequirement = { requirementId:string; parentRequirementId:string|null; capabilityGroupId:string; sourceText:string; sourceSection:string; normalizedRequirement:string; category:string; importance:string; capability:string; keywords:string[]; explicitRequirement:boolean; evaluationType:string; requiredLevel:RequirementLevel; confidence:number; status:string }
export type FactType = '背景事实' | '职责事实' | '行动事实' | '技术事实' | '数字事实' | '结果事实' | '项目状态事实' | '结果与状态事实'
export type FactRiskLevel = '低' | '中' | '高'
export type FactStatus = '已确认' | '待确认' | '明确不存在' | '信息不足' | '已删除'
export type ProjectStatus = '方案设计' | '原型' | '演示版本' | '最小可行产品' | '内部测试' | '正式上线'
export type Fact = { factId:string; experienceId:string; experienceName:string; content:string; type:FactType; sourceText:string; sourceLocation:string; riskLevel:FactRiskLevel; riskReason:string; reviewReason:string|null; requiresConfirmation:boolean; confidence:number; status:FactStatus; projectStatus?:ProjectStatus; numericDetail?:{value:string;unit:string;metric:string}; conflictNote?:string; previousContent?:string }
export type EvidenceMapping = { mappingId:string; requirementId:string; factIds:string[]; relevance:string; evidenceStrength:string; evidenceLevel:string; matchStatus:string; reason:string; confidence:number }
export type Gap = { gapId:string; requirementId:string; gapType:string; capabilityGapSubtype:string|null; reason:string; severity:string; rewritePermission:string; nextAction:string }
export type ResumeDiagnosis = { diagnosisId:string; resumeItemId:string; experienceId:string; experienceName:string; originalText:string; issueType:string; description:string; requirementIds:string[]; primaryRequirementId:string; mappingId?:string; gapId?:string; factIds:string[]; gapType:string; priority:string; suggestion:string; optimizable?:boolean; skipped?:boolean }
export type RewriteUserDecision = '待处理' | '已接受' | '已拒绝'
export type RewriteValidationStatus = '待事实校验' | '校验通过' | '校验不通过'
export type RewriteValidationClaim = { claimText:string; claimType:string; supported:boolean; supportingFactIds:string[]; reason:string }
export type RewriteValidation = { validationId:string; rewriteId:string; rewriteVersion?:string; status:RewriteValidationStatus; claims:RewriteValidationClaim[]; unsupportedClaims:string[]; usedFactIds:string[]; reason:string; validatedText?:string; confirmationMode?:'ai'|'user-confirmed' }
export type RewriteSuggestion = { rewriteId:string; version?:string; diagnosisId?:string; diagnosisIds?:string[]; resumeItemId?:string; experienceId?:string; experienceName?:string; originalText:string; optimizedText:string; editedText?:string; requirementIds:string[]; usedFactIds:string[]; reason:string; validationStatus:RewriteValidationStatus; validation?:RewriteValidation; userDecision:RewriteUserDecision }
export type MockResume = { resumeId:string; ownerName:string; targetRole:string; experiences:Array<{experienceId:string;title:string;organization:string;period:string;bullets:string[]}> }
