import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowTimeline } from "@/components/WorkflowTimeline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  actorCanCreateWorkRequests,
  formatDate,
  getProjectLabel,
  getWorkRequestStatusLabel,
  statusToSimple,
  type ActorRole,
  type AttachmentInput,
  type AttachmentRef,
  type Member,
  type WorkRequest,
  type WorkRequestStatus,
  usePortal,
} from "@/lib/portal-data";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Folder,
  GitMerge,
  History,
  Plus,
  Search,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type WorkRequestSearch = {
  requestId?: string;
  view?: "details" | "history" | "upload" | "action" | "focus";
};

export const Route = createFileRoute("/work-requests")({
  validateSearch: (search: Record<string, unknown>): WorkRequestSearch => ({
    requestId: typeof search.requestId === "string" ? search.requestId : undefined,
    view:
      search.view === "details" ||
      search.view === "history" ||
      search.view === "upload" ||
      search.view === "action" ||
      search.view === "focus"
        ? search.view
        : undefined,
  }),
  component: WorkRequestsPage,
  head: () => ({
    meta: [{ title: "Work Requests — Project Portal" }],
  }),
});

type DocumentFormRow = AttachmentInput;

type WorkflowAction =
  | "REQUEST_MARKETING_INFO"
  | "MARKETING_RETURN_PM"
  | "MARKETING_ESCALATE_CLIENT"
  | "CLIENT_PROVIDE_INFO"
  | "MEMBER_REQUEST_INFO"
  | "PM_RESPOND_MEMBER"
  | "PM_MEMBER_SUBMIT"
  | "PM_RETURN_MEMBER"
  | "ASSIGN_LEADER"
  | "ASSIGN_MEMBER"
  | "FORWARD_TO_TMS"
  | "ENGINEERING_REQUEST_PM_REVISION"
  | "TMS_MEMBER_REQUEST_LEAD"
  | "TMS_LEAD_RESPOND_MEMBER"
  | "ENGINEERING_SUBMIT_MARKETING"
  | "MARKETING_SUBMIT_CLIENT"
  | "MARKETING_REQUEST_ENGINEERING_REVISION"
  | "CLIENT_ACCEPT_FINAL"
  | "CLIENT_REJECT_FINAL"
  | "CLIENT_REQUEST_REVISION"
  | "MARKETING_ROUTE_CLIENT_REVISION_PM"
  | "ASSIGN_TMS_CHAIN"
  | "SUBMIT_DRAWING"
  | "CHECKING_APPROVE_REJECT"
  | "APPROVAL_APPROVE_REJECT"
  | "DIVISION_MEMBER_REVIEW"
  | "DIVISION_MANAGER_APPROVE"
  | "FORWARD_TO_CCR"
  | "FINAL_LIST"
  | "REQUEST_INFO"
  | "RESPOND_INFO"
  | "ENGINEERING_REQUEST_TMS_REVISION"
  | "MARKETING_SUBMIT_CLIENT_REVISION"
  | "MARKETING_ROUTE_CLIENT_REVISION_TMS";

type FileGroup = "PRIMARY" | "WORKFLOW";

type InfoTargetOption = {
  id: string;
  label: string;
  targetRole?: ActorRole;
  targetMemberId?: string;
  targetClientId?: string;
};



function createEmptyDocumentRow(category = "General", workflowStage = "Workflow Collaboration"): DocumentFormRow {
  return {
    name: "",
    category,
    textContent: "",
    workflowStage,
    note: "",
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size?: number) {
  if (!size) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function autoDocumentName(doc: DocumentFormRow) {
  if (doc.fileName?.trim()) return doc.fileName.trim();
  if (doc.name?.trim()) return doc.name.trim();

  if (doc.textContent?.trim()) {
    return `Text Document - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
  }

  return "";
}

function normalizeDocument(doc: DocumentFormRow) {
  const normalizedName = autoDocumentName(doc);

  const normalized = {
    ...doc,
    name: normalizedName,
    textContent: doc.textContent?.trim() || undefined,
    note: doc.note?.trim() || undefined,
  };

  if (!normalized.textContent && !normalized.fileDataUrl && !normalized.fileName) return null;
  return normalized;
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "document";
}

function ensureTxtExtension(name: string) {
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.txt`;
}

function getFileExtension(fileName?: string) {
  if (!fileName) return "";
  const cleanName = fileName.split("?")[0].split("#")[0];
  const parts = cleanName.split(".");
  if (parts.length < 2) return "";
  return parts.pop()?.trim().toLowerCase() || "";
}

function getFileTypeKey(doc: AttachmentRef) {
  const extension = getFileExtension(doc.fileName || doc.name);

  if (extension) return extension;

  if (doc.fileType?.includes("/")) {
    const subtype = doc.fileType.split("/")[1]?.toLowerCase() || "";
    return subtype.split(";")[0].split("+")[0] || "unknown";
  }

  if (doc.textContent && !doc.fileName) return "txt";

  return "unknown";
}

function getFileTypeLabel(type: string) {
  if (!type || type === "unknown") return "Unknown";
  return type.toUpperCase();
}

function getUploadedDateKey(uploadedAt?: string) {
  if (!uploadedAt) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(uploadedAt)) {
    return uploadedAt.slice(0, 10);
  }

  const parsed = new Date(uploadedAt);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function isImageFile(doc: AttachmentRef) {
  const type = doc.fileType?.toLowerCase() || "";
  const ext = getFileTypeKey(doc);
  return type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

function isPdfFile(doc: AttachmentRef) {
  const type = doc.fileType?.toLowerCase() || "";
  const ext = getFileTypeKey(doc);
  return type === "application/pdf" || ext === "pdf";
}

function filterAttachmentFiles(files: AttachmentRef[], search: string, fileType: string, uploadDate: string) {
  const normalizedSearch = search.trim().toLowerCase();

  return files.filter((doc) => {
    const fileName = `${doc.fileName || ""} ${doc.name || ""}`.toLowerCase();
    const matchesSearch = !normalizedSearch || fileName.includes(normalizedSearch);
    const matchesType = fileType === "ALL" || getFileTypeKey(doc) === fileType;
    const matchesDate = !uploadDate || getUploadedDateKey(doc.uploadedAt) === uploadDate;

    return matchesSearch && matchesType && matchesDate;
  });
}

async function downloadAttachment(doc: AttachmentRef) {
  if (typeof window === "undefined") return;

  if (doc.fileDataUrl) {
    try {
      const response = await fetch(doc.fileDataUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = safeFileName(doc.fileName || doc.name || "download");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      return;
    } catch {
      const link = document.createElement("a");
      link.href = doc.fileDataUrl;
      link.download = safeFileName(doc.fileName || doc.name || "download");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
  }

  const fallbackText = doc.textContent?.trim()
    ? doc.textContent
    : [
        `Document: ${doc.name}`,
        `Category: ${doc.category}`,
        `Workflow Stage: ${doc.workflowStage || "Workflow Collaboration"}`,
        `Uploaded By: ${doc.uploadedBy}`,
        `Uploaded At: ${formatDate(doc.uploadedAt)}`,
        "",
        doc.note || "Original file body is not available for this old/demo document because only metadata was stored.",
      ].join("\n");

  const blob = new Blob([fallbackText], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = ensureTxtExtension(safeFileName(doc.name || "document"));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function getAttachmentFileGroup(doc: AttachmentRef): FileGroup {
  const fileGroup = (doc as AttachmentRef & { fileGroup?: FileGroup }).fileGroup;
  return fileGroup || "PRIMARY";
}

function priorityClass(priority: WorkRequest["priority"]) {
  if (priority === "High") return "text-rose-600";
  if (priority === "Medium") return "text-orange-600";
  return "text-slate-600 dark:text-slate-300";
}

function requestStageLabel(status: WorkRequestStatus) {
  if (status === "HML_LISTED") return "Completed";
  if (["INFO_REQUESTED_FROM_MARKETING", "INFO_REQUESTED_FROM_CLIENT", "CLIENT_INFO_PROVIDED", "MARKETING_INFO_PROVIDED"].includes(status)) return "Info Loop";
  if (["MEMBER_REVIEW", "MEMBER_INFO_REQUESTED", "PM_LEAD_RESPONDED", "PM_MEMBER_SUBMITTED", "PM_REWORK_REQUESTED"].includes(status)) return "PM Work";
  if (["FORWARDED_TO_TMS", "ENGINEERING_REVISION_REQUESTED", "TMS_MEMBER_INFO_REQUESTED", "TMS_ASSIGNED", "DRAWING_IN_PROGRESS", "CHECKING_REVIEW", "APPROVAL_REVIEW", "ENGINEERING_LEAD_REVIEW"].includes(status)) return "Engineering";
  if (["FINAL_SUBMITTED_TO_MARKETING", "FINAL_SUBMITTED_TO_CLIENT", "CLIENT_REVISION_REQUESTED"].includes(status)) return "Delivery";
  if (status === "FORWARDED_TO_CCR") return "At CCR";
  if (status === "DIVISION_MEMBER_APPROVED" || status === "DIVISION_MANAGER_APPROVED") return "PM Approval";
  return "PM Review";
}

function workflowStepIndex(status: WorkRequestStatus) {
  if (status === "CREATED") return 0;
  if (status === "DIVISION_NOTIFIED" || status === "LEADER_ASSIGNED") return 1;
  if (["INFO_REQUESTED_FROM_MARKETING", "INFO_REQUESTED_FROM_CLIENT", "CLIENT_INFO_PROVIDED", "MARKETING_INFO_PROVIDED"].includes(status)) return 2;
  if (["MEMBER_REVIEW", "MEMBER_INFO_REQUESTED", "PM_LEAD_RESPONDED", "PM_REWORK_REQUESTED"].includes(status)) return 3;
  if (status === "PM_MEMBER_SUBMITTED") return 4;
  if (status === "FORWARDED_TO_TMS" || status === "ENGINEERING_REVISION_REQUESTED" || status === "TMS_MEMBER_INFO_REQUESTED") return 5;
  if (status === "TMS_ASSIGNED") return 6;
  if (status === "DRAWING_IN_PROGRESS") return 7;
  if (status === "CHECKING_REVIEW") return 8;
  if (status === "APPROVAL_REVIEW") return 9;
  if (status === "ENGINEERING_LEAD_REVIEW") return 10;
  if (status === "FINAL_SUBMITTED_TO_MARKETING") return 11;
  if (status === "FINAL_SUBMITTED_TO_CLIENT" || status === "CLIENT_REVISION_REQUESTED") return 12;
  if (status === "HML_LISTED") return 13;
  return 0;
}

function getWorkflowSteps(request: WorkRequest, divisionAbbr = "ECM") {
  const idx = workflowStepIndex(request.currentStatus);

  const allSteps = [
    { label: "Marketing Intake", department: "CCR" },
    { label: `${divisionAbbr} PM Lead Review`, department: divisionAbbr },
    { label: "Clarification Loop", department: "Client / CCR / PM" },
    { label: `${divisionAbbr} PM Member Work`, department: divisionAbbr },
    { label: `${divisionAbbr} PM Lead QC`, department: divisionAbbr },
    { label: "Engineering Lead Review", department: "TMS" },
    { label: "Engineering Chain Assigned", department: "TMS Manager" },
    { label: "TMS-M1 Drawing", department: "M1" },
    { label: "TMS-M2 Checking", department: "M2" },
    { label: "TMS-M3 Approval", department: "M3" },
    { label: "Engineering Lead Final", department: "TMS" },
    { label: "Marketing Delivery", department: "CCR" },
    { label: "Client Acceptance", department: "Client" },
    { label: "Cycle Complete", department: "HML" },
  ];

  return allSteps.map((step, stepIdx) => ({
    label: step.label,
    department: step.department,
    status:
      request.currentStatus === "HML_LISTED" || stepIdx < idx
        ? ("completed" as const)
        : stepIdx === idx
          ? ("active" as const)
          : ("pending" as const),
  }));
}

function getDefaultActionUploadStage(status: WorkRequestStatus) {
  if (["INFO_REQUESTED_FROM_MARKETING", "INFO_REQUESTED_FROM_CLIENT", "CLIENT_INFO_PROVIDED", "MARKETING_INFO_PROVIDED"].includes(status)) return "Marketing / Client Clarification";
  if (["MEMBER_REVIEW", "MEMBER_INFO_REQUESTED", "PM_LEAD_RESPONDED", "PM_REWORK_REQUESTED"].includes(status)) return "PM Member Work";
  if (status === "PM_MEMBER_SUBMITTED") return "PM Lead Quality Control";
  if (status === "FORWARDED_TO_TMS" || status === "ENGINEERING_REVISION_REQUESTED" || status === "TMS_MEMBER_INFO_REQUESTED") return "TMS Manager Assignment";
  if (status === "TMS_ASSIGNED" || status === "DRAWING_IN_PROGRESS") return "TMS Drawing - M1";
  if (status === "CHECKING_REVIEW") return "TMS Checking - M2";
  if (status === "APPROVAL_REVIEW") return "TMS Approval - M3";
  if (status === "ENGINEERING_LEAD_REVIEW") return "Engineering Lead Final Review";
  if (status === "FINAL_SUBMITTED_TO_MARKETING") return "Marketing Final Delivery";
  if (status === "FINAL_SUBMITTED_TO_CLIENT" || status === "CLIENT_REVISION_REQUESTED") return "Client Acceptance";
  if (status === "FORWARDED_TO_CCR") return "CCR Closeout";
  if (status === "HML_LISTED") return "HML Registry";
  return "Workflow Collaboration";
}

function getBackwardTargetLabel(status: WorkRequestStatus) {
  const map: Partial<Record<WorkRequestStatus, string>> = {
    INFO_REQUESTED_FROM_MARKETING: "PM Lead Initial Review",
    INFO_REQUESTED_FROM_CLIENT: "CCR / Marketing Review",
    CLIENT_INFO_PROVIDED: "Client Information Request",
    MARKETING_INFO_PROVIDED: "CCR / Marketing Clarification",
    LEADER_ASSIGNED: "PM Lead Initial Review",
    MEMBER_REVIEW: "PM Lead Assignment",
    MEMBER_INFO_REQUESTED: "PM Member Work",
    PM_LEAD_RESPONDED: "PM Member Query",
    PM_MEMBER_SUBMITTED: "PM Member Work",
    PM_REWORK_REQUESTED: "PM Lead QC",
    FORWARDED_TO_TMS: "PM Lead QC",
    ENGINEERING_REVISION_REQUESTED: "Engineering Lead Review",
    TMS_MEMBER_INFO_REQUESTED: "TMS Member Request",
    TMS_ASSIGNED: "Engineering Lead Review",
    DRAWING_IN_PROGRESS: "TMS Chain Assignment",
    CHECKING_REVIEW: "TMS-M1 Drawing Rework",
    APPROVAL_REVIEW: "TMS-M2 Checking Rework",
    ENGINEERING_LEAD_REVIEW: "TMS-M3 Approval",
    FINAL_SUBMITTED_TO_MARKETING: "Engineering Lead Final Review",
    FINAL_SUBMITTED_TO_CLIENT: "CCR / Marketing Final Review",
    CLIENT_REVISION_REQUESTED: "Client Acceptance Review",
    RETURNED_TO_DIVISION: "TMS-M3 Approval Rework",
    DIVISION_MEMBER_APPROVED: "PM Member Final Review",
    DIVISION_MANAGER_APPROVED: "PM Member Approved Stage",
    FORWARDED_TO_CCR: "PM Lead Approval",
  };

  return map[status];
}

function shouldShowGenericBackward(status: WorkRequestStatus) {
  return !["CHECKING_REVIEW", "APPROVAL_REVIEW", "RETURNED_TO_DIVISION"].includes(status);
}

function getAttachmentStableKey(doc: AttachmentRef) {
  return (doc.versionKey || doc.fileName || doc.name || doc.id).trim().toLowerCase();
}

function getDocumentRevisionGroups(files: AttachmentRef[]) {
  const groups = new Map<string, AttachmentRef[]>();

  files.forEach((file) => {
    const displayKey = getAttachmentStableKey(file) || file.id;
    const existing = groups.get(displayKey) || [];
    existing.push(file);
    groups.set(displayKey, existing);
  });

  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      name: items[0]?.fileName || items[0]?.name || "Untitled document",
      revisions: items.sort((a, b) => {
        const versionDiff = (a.version || 1) - (b.version || 1);
        if (versionDiff !== 0) return versionDiff;
        return a.uploadedAt.localeCompare(b.uploadedAt);
      }),
      latestAt: items.reduce((latest, item) => (item.uploadedAt > latest ? item.uploadedAt : latest), items[0]?.uploadedAt || ""),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

function isUploadHistoryEntry(entry: WorkRequest["revisionHistory"][number]) {
  return entry.action.toLowerCase().startsWith("uploaded workflow document");
}

function getStandaloneRevisionMessages(request: WorkRequest) {
  return request.revisionHistory.filter((entry) => entry.note?.trim() && !isUploadHistoryEntry(entry));
}

function getPendingActionFeedbackMessages(request: WorkRequest) {
  const latestIncomingMessage = request.revisionHistory.find((entry) => entry.note?.trim() && !isUploadHistoryEntry(entry));
  return latestIncomingMessage ? [latestIncomingMessage] : [];
}

function WorkRequestsPage() {
  const routeSearch = Route.useSearch();
  const appliedNotificationRouteRef = useRef("");

  const {
    state,
    currentActor,
    addWorkRequest,
    addWorkRequestDocument,
    addWorkRequestNote,
    requestWorkflowInfo,
    respondWorkflowInfo,
    marketingReturnToPm,
    marketingEscalateToClient,
    clientProvideInfo,
    pmLeadRespondToMember,
    pmMemberSubmit,
    pmReturnToMember,
    assignLeader,
    assignMember,
    forwardToTms,
    engineeringRequestPmRevision,
    tmsLeadRespondToMember,
    engineeringSubmitToMarketing,
    marketingSubmitToClient,
    marketingRequestEngineeringRevision,
    marketingRouteClientRevisionToTms,
    marketingSubmitClientRevision,
    engineeringRequestTmsRevision,
    clientAcceptFinal,
    clientRejectFinal,
    clientRequestRevision,
    marketingSendClientRevisionToPm,
    assignTmsChain,
    submitDrawing,
    reviewChecking,
    reviewApproval,
    originMemberDecision,
    originManagerApprove,
    forwardToCcr,
    listFinalDocument,
  } = usePortal();

  const workRequestTypes = state.settings.workRequestTypes?.length ? state.settings.workRequestTypes : state.settings.categories;
  const projectInfoCategories = state.settings.projectInfoCategories?.length ? state.settings.projectInfoCategories : state.settings.categories;

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedParentIds, setExpandedParentIds] = useState<string[]>([]);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [uploadRequestId, setUploadRequestId] = useState<string | null>(null);
  const [historyRequestId, setHistoryRequestId] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AttachmentRef | null>(null);
  const [historyMode, setHistoryMode] = useState<"TRANSFER" | "REVISION">("TRANSFER");
  const [detailFileSearch, setDetailFileSearch] = useState("");
  const [detailFileType, setDetailFileType] = useState("ALL");
  const [detailFileDate, setDetailFileDate] = useState("");

  const [createForm, setCreateForm] = useState({
    parentType: "BID" as "BID" | "PROJECT",
    parentId: state.projects.find((project) => project.type === "BID" && project.status !== "ARCHIVED")?.id || "",
    title: "",
    category: workRequestTypes[0] || "General",
    priority: "High" as "High" | "Medium" | "Low",
    attachmentCategory: projectInfoCategories[0] || "General",
    notes: "",
    assignedDivisionId: "div-ecm",
  });

  const [leaderChoice, setLeaderChoice] = useState("");
  const [memberChoice, setMemberChoice] = useState("");
  const [tmsChoice, setTmsChoice] = useState({
    drawingId: "member-tms-m1",
    checkingId: "member-tms-m2",
    approvalId: "member-tms-m3",
  });
  const [actionNotes, setActionNotes] = useState<Partial<Record<WorkflowAction, string>>>({});
  const [uploadDoc, setUploadDoc] = useState<DocumentFormRow>(createEmptyDocumentRow(state.settings.categories[0] || "General"));
  const [uploadFiles, setUploadFiles] = useState<DocumentFormRow[]>([]);
  const [actionDoc, setActionDoc] = useState<DocumentFormRow>(createEmptyDocumentRow(state.settings.categories[0] || "General"));
  const [actionFiles, setActionFiles] = useState<DocumentFormRow[]>([]);
  const [selectedPackageFileIds, setSelectedPackageFileIds] = useState<string[]>([]);
  const [infoTargetChoice, setInfoTargetChoice] = useState("");
  const [actionDisplayChoice, setActionDisplayChoice] = useState("");
  const [listDocForm, setListDocForm] = useState({ name: "", category: state.settings.categories[0] || "General" });
  const [showListDialog, setShowListDialog] = useState<string | null>(null);

  const availableParents = useMemo(() => {
    if (createForm.parentType === "BID") {
      return state.projects.filter((project) => project.type === "BID" && project.status !== "ARCHIVED");
    }

    return state.projects.filter((project) => project.type === "PROJECT" && project.status === "ACTIVE");
  }, [createForm.parentType, state.projects]);

  useEffect(() => {
    if (!availableParents.length) {
      setCreateForm((prev) => ({ ...prev, parentId: "" }));
      return;
    }

    if (!availableParents.some((project) => project.id === createForm.parentId)) {
      setCreateForm((prev) => ({ ...prev, parentId: availableParents[0]?.id || "" }));
    }
  }, [availableParents, createForm.parentId]);

  useEffect(() => {
    if (!detailRequestId) {
      setDetailFileSearch("");
      setDetailFileType("ALL");
      setDetailFileDate("");
    }
  }, [detailRequestId]);

  useEffect(() => {
    if (!historyRequestId) {
      setHistoryMode("TRANSFER");
    }
  }, [historyRequestId]);

  const getCurrentMember = () => {
    if (!currentActor.memberId) return undefined;
    return state.members.find((member) => member.id === currentActor.memberId);
  };

  const isDivisionLeadFor = (member: Member | undefined, divisionId?: string) => {
    if (!member || !divisionId) return false;
    return member.divisionId === divisionId && /lead|manager|leader/i.test(member.roleTitle);
  };

  const isWorkflowSupervisor = currentActor.role === "system_admin" || currentActor.role === "prime_consultant";

  const getDivisionLeadMember = (divisionId?: string) =>
    state.members.find((member) => member.divisionId === divisionId && /lead|manager|leader/i.test(member.roleTitle));

  const getTmsManagerMember = () =>
    state.members.find((member) => member.divisionId === "div-tms-eng" && /manager|lead|leader/i.test(member.roleTitle));

  const getInfoTargetOptions = (request: WorkRequest): InfoTargetOption[] => {
    const options: InfoTargetOption[] = [];
    const addOption = (option?: InfoTargetOption | null) => {
      if (!option?.id || !option.label || options.some((item) => item.id === option.id)) return;
      options.push(option);
    };

    const assignedLead = request.assignedLeaderId
      ? state.members.find((member) => member.id === request.assignedLeaderId)
      : getDivisionLeadMember(request.assignedDivisionId);
    const assignedMember = request.assignedMemberId
      ? state.members.find((member) => member.id === request.assignedMemberId)
      : undefined;
    const tmsManager = getTmsManagerMember();
    const client = state.clients.find((item) => item.id === getProject(request.parentId)?.clientId);

    const ccrTarget = { id: "role:ccr_coordinator", label: "CCR / Marketing", targetRole: "ccr_coordinator" as ActorRole };
    const clientTarget = client ? { id: `client:${client.id}`, label: `Client / Owner — ${client.name}`, targetRole: "client_owner" as ActorRole, targetClientId: client.id } : null;
    const pmLeadTarget = assignedLead
      ? { id: `member:${assignedLead.id}`, label: `PM Lead — ${assignedLead.name}`, targetRole: "division_lead" as ActorRole, targetMemberId: assignedLead.id }
      : null;
    const pmMemberTarget = assignedMember
      ? { id: `member:${assignedMember.id}`, label: `PM Member — ${assignedMember.name}`, targetRole: "division_member" as ActorRole, targetMemberId: assignedMember.id }
      : null;
    const tmsManagerTarget = tmsManager
      ? { id: `member:${tmsManager.id}`, label: `TMS Manager — ${tmsManager.name}`, targetRole: "tms_manager" as ActorRole, targetMemberId: tmsManager.id }
      : { id: "role:tms_manager", label: "TMS Manager", targetRole: "tms_manager" as ActorRole };

    const tmsMemberTargets = [
      request.tmsAssignments?.drawingId ? { id: `member:${request.tmsAssignments.drawingId}`, label: `TMS-M1 — ${getMemberName(request.tmsAssignments.drawingId)}`, targetMemberId: request.tmsAssignments.drawingId, targetRole: "tms_drawing" as ActorRole } : null,
      request.tmsAssignments?.checkingId ? { id: `member:${request.tmsAssignments.checkingId}`, label: `TMS-M2 — ${getMemberName(request.tmsAssignments.checkingId)}`, targetMemberId: request.tmsAssignments.checkingId, targetRole: "tms_checking" as ActorRole } : null,
      request.tmsAssignments?.approvalId ? { id: `member:${request.tmsAssignments.approvalId}`, label: `TMS-M3 — ${getMemberName(request.tmsAssignments.approvalId)}`, targetMemberId: request.tmsAssignments.approvalId, targetRole: "tms_approval" as ActorRole } : null,
    ];

    switch (currentActor.role) {
      case "client_owner":
        addOption(ccrTarget);
        break;
      case "ccr_coordinator":
        addOption(clientTarget);
        addOption(pmLeadTarget);
        addOption(tmsManagerTarget);
        break;
      case "division_lead":
        addOption(ccrTarget);
        addOption(pmMemberTarget);
        addOption(tmsManagerTarget);
        break;
      case "division_member":
        addOption(pmLeadTarget);
        break;
      case "tms_manager":
        addOption(pmLeadTarget);
        tmsMemberTargets.forEach(addOption);
        break;
      case "tms_drawing":
      case "tms_checking":
      case "tms_approval":
        addOption(tmsManagerTarget);
        break;
      case "system_admin":
      case "prime_consultant":
        addOption(ccrTarget);
        addOption(clientTarget);
        addOption(pmLeadTarget);
        addOption(pmMemberTarget);
        addOption(tmsManagerTarget);
        tmsMemberTargets.forEach(addOption);
        break;
      default:
        break;
    }

    return options.filter((option) => {
      if (option.targetMemberId && option.targetMemberId === currentActor.memberId) return false;
      if (option.targetClientId && option.targetClientId === currentActor.clientId) return false;
      if (!option.targetMemberId && !option.targetClientId && option.targetRole === currentActor.role) return false;
      return true;
    });
  };

  const isPendingInfoTarget = (request: WorkRequest) => {
    const pending = request.pendingInfoRequest;
    if (!pending) return false;
    if (isWorkflowSupervisor) return true;
    if (pending.targetMemberId && pending.targetMemberId === currentActor.memberId) return true;
    if (pending.targetClientId && pending.targetClientId === currentActor.clientId) return true;
    if (!pending.targetMemberId && !pending.targetClientId && pending.targetRole === currentActor.role) return true;
    return false;
  };

  const isCcrRevisionReadyForTmsAssignment = (request: WorkRequest) => {
    const latest = request.revisionHistory[0];

    return Boolean(
      request.currentStatus === "ENGINEERING_LEAD_REVIEW" &&
        latest?.from === "CCR / Marketing" &&
        latest?.to === "TMS Engineering Lead" &&
        /revision/i.test(latest.action)
    );
  };

  const canPerformAction = (request: WorkRequest, action: WorkflowAction) => {
    const member = getCurrentMember();
    const isAssignedDivisionLead = currentActor.role === "division_lead" && isDivisionLeadFor(member, request.assignedDivisionId);
    const isOriginDivisionLead = currentActor.role === "division_lead" && isDivisionLeadFor(member, request.originDivisionId);
    const isAssignedMember = currentActor.role === "division_member" && currentActor.memberId === request.assignedMemberId;
    const isAssignedTmsDrawing = Boolean(request.tmsAssignments?.drawingId && currentActor.memberId === request.tmsAssignments.drawingId);
    const isAssignedTmsChecking = Boolean(request.tmsAssignments?.checkingId && currentActor.memberId === request.tmsAssignments.checkingId);
    const isAssignedTmsApproval = Boolean(request.tmsAssignments?.approvalId && currentActor.memberId === request.tmsAssignments.approvalId);
    const isMarketing = currentActor.role === "ccr_coordinator";
    const isClient = currentActor.role === "client_owner";

    switch (action) {
      case "REQUEST_MARKETING_INFO":
        return (
          ["DIVISION_NOTIFIED", "LEADER_ASSIGNED", "MARKETING_INFO_PROVIDED", "MEMBER_INFO_REQUESTED", "ENGINEERING_REVISION_REQUESTED", "CLIENT_REVISION_REQUESTED"].includes(request.currentStatus) &&
          (isWorkflowSupervisor || isAssignedDivisionLead || isOriginDivisionLead)
        );

      case "MARKETING_RETURN_PM":
        return ["INFO_REQUESTED_FROM_MARKETING", "CLIENT_INFO_PROVIDED"].includes(request.currentStatus) && (isWorkflowSupervisor || isMarketing);

      case "MARKETING_ESCALATE_CLIENT":
        return request.currentStatus === "INFO_REQUESTED_FROM_MARKETING" && (isWorkflowSupervisor || isMarketing);

      case "CLIENT_PROVIDE_INFO":
        return request.currentStatus === "INFO_REQUESTED_FROM_CLIENT" && (isWorkflowSupervisor || isClient);

      case "MEMBER_REQUEST_INFO":
        return ["MEMBER_REVIEW", "PM_REWORK_REQUESTED", "PM_LEAD_RESPONDED"].includes(request.currentStatus) && (isWorkflowSupervisor || isAssignedMember);

      case "PM_RESPOND_MEMBER":
        return request.currentStatus === "MEMBER_INFO_REQUESTED" && (isWorkflowSupervisor || isAssignedDivisionLead || isOriginDivisionLead);

      case "PM_MEMBER_SUBMIT":
        return ["MEMBER_REVIEW", "PM_REWORK_REQUESTED", "PM_LEAD_RESPONDED"].includes(request.currentStatus) && (isWorkflowSupervisor || isAssignedMember);

      case "PM_RETURN_MEMBER":
        return request.currentStatus === "PM_MEMBER_SUBMITTED" && (isWorkflowSupervisor || isAssignedDivisionLead || isOriginDivisionLead);

      case "ASSIGN_LEADER":
        return request.currentStatus === "DIVISION_NOTIFIED" && isWorkflowSupervisor;

      case "ASSIGN_MEMBER":
        return (
          ["DIVISION_NOTIFIED", "LEADER_ASSIGNED", "MARKETING_INFO_PROVIDED", "ENGINEERING_REVISION_REQUESTED", "CLIENT_REVISION_REQUESTED"].includes(request.currentStatus) &&
          (isWorkflowSupervisor || isAssignedDivisionLead || isOriginDivisionLead)
        );

      case "FORWARD_TO_TMS":
        return request.currentStatus === "PM_MEMBER_SUBMITTED" && (isWorkflowSupervisor || isAssignedDivisionLead || isOriginDivisionLead);

      case "ENGINEERING_REQUEST_PM_REVISION":
        return ["FORWARDED_TO_TMS", "ENGINEERING_LEAD_REVIEW"].includes(request.currentStatus) && (isWorkflowSupervisor || currentActor.role === "tms_manager");

      case "ENGINEERING_REQUEST_TMS_REVISION":
        return request.currentStatus === "ENGINEERING_LEAD_REVIEW" && (isWorkflowSupervisor || currentActor.role === "tms_manager");

      case "TMS_MEMBER_REQUEST_LEAD":
        return (
          ["TMS_ASSIGNED", "DRAWING_IN_PROGRESS"].includes(request.currentStatus) &&
          (isWorkflowSupervisor || isAssignedTmsDrawing)
        ) || (
          request.currentStatus === "CHECKING_REVIEW" &&
          (isWorkflowSupervisor || isAssignedTmsChecking)
        ) || (
          request.currentStatus === "APPROVAL_REVIEW" &&
          (isWorkflowSupervisor || isAssignedTmsApproval)
        );

      case "TMS_LEAD_RESPOND_MEMBER":
        return request.currentStatus === "TMS_MEMBER_INFO_REQUESTED" && (isWorkflowSupervisor || currentActor.role === "tms_manager");

      case "ENGINEERING_SUBMIT_MARKETING":
        return request.currentStatus === "ENGINEERING_LEAD_REVIEW" && (isWorkflowSupervisor || currentActor.role === "tms_manager");

      case "MARKETING_SUBMIT_CLIENT":
        return request.currentStatus === "FINAL_SUBMITTED_TO_MARKETING" && (isWorkflowSupervisor || isMarketing);

      case "MARKETING_REQUEST_ENGINEERING_REVISION":
        return request.currentStatus === "FINAL_SUBMITTED_TO_MARKETING" && (isWorkflowSupervisor || isMarketing);

      case "MARKETING_ROUTE_CLIENT_REVISION_TMS":
        return request.currentStatus === "CLIENT_REVISION_REQUESTED" && (isWorkflowSupervisor || isMarketing);

      case "MARKETING_SUBMIT_CLIENT_REVISION":
        return request.currentStatus === "CLIENT_REVISION_REQUESTED" && (isWorkflowSupervisor || isMarketing);

      case "CLIENT_ACCEPT_FINAL":
        return ["FINAL_SUBMITTED_TO_CLIENT", "REJECTED"].includes(request.currentStatus) && (isWorkflowSupervisor || isClient);

      case "CLIENT_REJECT_FINAL":
        return request.currentStatus === "FINAL_SUBMITTED_TO_CLIENT" && (isWorkflowSupervisor || isClient);

      case "CLIENT_REQUEST_REVISION":
        return ["FINAL_SUBMITTED_TO_CLIENT", "REJECTED"].includes(request.currentStatus) && (isWorkflowSupervisor || isClient);

      case "MARKETING_ROUTE_CLIENT_REVISION_PM":
        return false;

      case "ASSIGN_TMS_CHAIN":
        return (request.currentStatus === "FORWARDED_TO_TMS" || isCcrRevisionReadyForTmsAssignment(request)) && (isWorkflowSupervisor || currentActor.role === "tms_manager");

      case "SUBMIT_DRAWING":
        return (
          (request.currentStatus === "TMS_ASSIGNED" || request.currentStatus === "DRAWING_IN_PROGRESS") &&
          (isWorkflowSupervisor || isAssignedTmsDrawing)
        );

      case "CHECKING_APPROVE_REJECT":
        return (
          request.currentStatus === "CHECKING_REVIEW" &&
          (isWorkflowSupervisor || isAssignedTmsChecking)
        );

      case "APPROVAL_APPROVE_REJECT":
        return (
          request.currentStatus === "APPROVAL_REVIEW" &&
          (isWorkflowSupervisor || isAssignedTmsApproval)
        );

      case "DIVISION_MEMBER_REVIEW":
        return request.currentStatus === "RETURNED_TO_DIVISION" && (isWorkflowSupervisor || isAssignedMember);

      case "DIVISION_MANAGER_APPROVE":
        return request.currentStatus === "DIVISION_MEMBER_APPROVED" && (isWorkflowSupervisor || isOriginDivisionLead);

      case "FORWARD_TO_CCR":
        return request.currentStatus === "DIVISION_MANAGER_APPROVED" && (isWorkflowSupervisor || isOriginDivisionLead);

      case "FINAL_LIST":
        return request.currentStatus === "FORWARDED_TO_CCR" && (isWorkflowSupervisor || isMarketing);

      case "REQUEST_INFO":
        return (!request.pendingInfoRequest || isPendingInfoTarget(request)) && getInfoTargetOptions(request).length > 0;

      case "RESPOND_INFO":
        return isPendingInfoTarget(request);

      default:
        return false;
    }
  };

  const hasWorkflowAction = (request: WorkRequest) => {
    const actions: WorkflowAction[] = [
      "MARKETING_RETURN_PM",
      "MARKETING_ESCALATE_CLIENT",
      "CLIENT_PROVIDE_INFO",
      "PM_RESPOND_MEMBER",
      "PM_MEMBER_SUBMIT",
      "PM_RETURN_MEMBER",
      "ASSIGN_LEADER",
      "ASSIGN_MEMBER",
      "FORWARD_TO_TMS",
      "ENGINEERING_REQUEST_PM_REVISION",
      "TMS_LEAD_RESPOND_MEMBER",
      "ENGINEERING_SUBMIT_MARKETING",
      "MARKETING_SUBMIT_CLIENT",
      "MARKETING_REQUEST_ENGINEERING_REVISION",
      "CLIENT_ACCEPT_FINAL",
      "CLIENT_REJECT_FINAL",
      "CLIENT_REQUEST_REVISION",
      "MARKETING_ROUTE_CLIENT_REVISION_PM",
      "ASSIGN_TMS_CHAIN",
      "SUBMIT_DRAWING",
      "CHECKING_APPROVE_REJECT",
      "APPROVAL_APPROVE_REJECT",
      "DIVISION_MEMBER_REVIEW",
      "DIVISION_MANAGER_APPROVE",
      "FORWARD_TO_CCR",
      "FINAL_LIST",
      "REQUEST_INFO",
      "RESPOND_INFO",
      "ENGINEERING_REQUEST_TMS_REVISION",
      "MARKETING_SUBMIT_CLIENT_REVISION",
      "MARKETING_ROUTE_CLIENT_REVISION_TMS",
    ];

    return actions.some((action) => canPerformAction(request, action));
  };

  const visibleRequests = useMemo(() => {
    const q = search.toLowerCase();

    return state.workRequests.filter((request) => {
      const member = currentActor.memberId ? state.members.find((item) => item.id === currentActor.memberId) : undefined;

      const belongsByRole = (() => {
        switch (currentActor.role) {
          case "system_admin":
          case "prime_consultant":
          case "ccr_coordinator":
            return true;

          case "client_owner": {
            const parent = state.projects.find((project) => project.id === request.parentId);
            return parent?.clientId === currentActor.clientId;
          }

          case "division_lead":
            return member?.divisionId === request.assignedDivisionId || member?.divisionId === request.originDivisionId;

          case "division_member":
            return request.assignedMemberId === currentActor.memberId || member?.divisionId === request.originDivisionId || member?.divisionId === request.assignedDivisionId;

          case "tms_manager":
            return ["FORWARDED_TO_TMS", "ENGINEERING_REVISION_REQUESTED", "TMS_MEMBER_INFO_REQUESTED", "TMS_ASSIGNED", "DRAWING_IN_PROGRESS", "CHECKING_REVIEW", "APPROVAL_REVIEW", "ENGINEERING_LEAD_REVIEW", "FINAL_SUBMITTED_TO_MARKETING"].includes(request.currentStatus);

          case "tms_drawing":
          case "tms_checking":
          case "tms_approval":
            return Boolean(
              currentActor.memberId &&
                (request.tmsAssignments?.drawingId === currentActor.memberId ||
                  request.tmsAssignments?.checkingId === currentActor.memberId ||
                  request.tmsAssignments?.approvalId === currentActor.memberId)
            );

          default:
            return false;
        }
      })();

      const matches = !q || request.title.toLowerCase().includes(q) || request.code.toLowerCase().includes(q);
      const isInfoRequester = request.pendingInfoRequest?.requestedByActorId === currentActor.id;
      return (belongsByRole || isPendingInfoTarget(request) || isInfoRequester) && matches;
    });
  }, [currentActor.clientId, currentActor.memberId, currentActor.role, search, state.members, state.projects, state.workRequests]);

  const groupedVisibleRequests = useMemo(() => {
    const groups: { parentId: string; parent?: (typeof state.projects)[number]; requests: WorkRequest[] }[] = [];
    const groupIndex = new Map<string, number>();

    visibleRequests.forEach((request) => {
      const parentId = request.parentId || "no-parent";
      let index = groupIndex.get(parentId);

      if (index === undefined) {
        index = groups.length;
        groupIndex.set(parentId, index);
        groups.push({ parentId, parent: state.projects.find((project) => project.id === request.parentId), requests: [] });
      }

      groups[index].requests.push(request);
    });

    return groups;
  }, [visibleRequests, state.projects]);

  const isParentFolderExpanded = (parentId: string) => Boolean(search.trim()) || expandedParentIds.includes(parentId);

  const toggleParentFolder = (parentId: string) => {
    setExpandedParentIds((prev) => (prev.includes(parentId) ? prev.filter((id) => id !== parentId) : [...prev, parentId]));
  };

  const canCreate = actorCanCreateWorkRequests(currentActor.role);
  const selectedParent = state.projects.find((project) => project.id === createForm.parentId);
  const detailRequest = state.workRequests.find((request) => request.id === detailRequestId);
  const uploadRequest = state.workRequests.find((request) => request.id === uploadRequestId);
  const historyRequest = state.workRequests.find((request) => request.id === historyRequestId);
  const actionRequest = state.workRequests.find((request) => request.id === actionRequestId);

  const getLeaderOptions = (divisionId: string) =>
    state.members.filter((member) => member.divisionId === divisionId && /lead|manager|leader/i.test(member.roleTitle));

  const getMemberOptions = (divisionId: string) =>
    state.members.filter((member) => member.divisionId === divisionId && !/manager|leader/i.test(member.roleTitle));

  const getMemberName = (memberId?: string) => state.members.find((member) => member.id === memberId)?.name || "—";
  const getDivision = (divisionId?: string) => state.divisions.find((division) => division.id === divisionId);
  const getProject = (projectId?: string) => state.projects.find((project) => project.id === projectId);

  const getActionUploadFileKeys = () => actionFiles.map((file) => file.fileName || file.name).filter(Boolean) as string[];

  const getRelatedRequestsForParent = (parentId?: string) => state.workRequests.filter((request) => request.parentId === parentId);

  const isWorkflowFileForRequest = (file: AttachmentRef, request: WorkRequest) => {
    if (getAttachmentFileGroup(file) !== "WORKFLOW") return false;
    if (file.workRequestId) return file.workRequestId === request.id;
    return getRelatedRequestsForParent(request.parentId).length <= 1;
  };

  const isStoredFileAttachment = (file: AttachmentRef) => Boolean(file.fileName || file.fileDataUrl);

  const getRequestWorkflowFiles = (request: WorkRequest) =>
    (getProject(request.parentId)?.initialDocuments || []).filter((file) => isWorkflowFileForRequest(file, request) && isStoredFileAttachment(file));

  const getRequestProjectFiles = (request: WorkRequest) =>
    (getProject(request.parentId)?.initialDocuments || []).filter(
      (file) => getAttachmentFileGroup(file) === "PRIMARY" || (isWorkflowFileForRequest(file, request) && isStoredFileAttachment(file))
    );

  const getFilesByIds = (request: WorkRequest, ids?: string[]) => {
    if (!ids?.length) return [];
    const idSet = new Set(ids);
    return getRequestProjectFiles(request).filter((file) => idSet.has(file.id));
  };

  const getFallbackFinalPackageFiles = (request: WorkRequest) => {
    const stagePriority = [
      "Engineering Lead Final Review",
      "Marketing Final Delivery",
      "TMS Approval - M3",
      "TMS Checking - M2",
      "TMS Drawing - M1",
    ];

    const files = getRequestProjectFiles(request)
      .filter((file) => getAttachmentFileGroup(file) === "WORKFLOW")
      .filter((file) => stagePriority.includes(file.workflowStage || ""))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    const seen = new Set<string>();
    return files.filter((file) => {
      const key = getAttachmentStableKey(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getFinalPackageFiles = (request: WorkRequest) => {
    const directFiles = getFilesByIds(request, request.finalPackageAttachmentIds);
    return directFiles.length ? directFiles : getFallbackFinalPackageFiles(request);
  };

  const getClientRevisionFiles = (request: WorkRequest) => getFilesByIds(request, request.clientRevisionAttachmentIds);

  const getCurrentHandler = (request: WorkRequest) => {
    if (request.pendingInfoRequest) return `Info requested from ${request.pendingInfoRequest.targetLabel}`;
    if (request.currentStatus === "HML_LISTED") return "Client Accepted / HML";
    if (["INFO_REQUESTED_FROM_MARKETING", "CLIENT_INFO_PROVIDED", "FINAL_SUBMITTED_TO_MARKETING", "CLIENT_REVISION_REQUESTED", "FORWARDED_TO_CCR"].includes(request.currentStatus)) return "CCR / Marketing";
    if (["INFO_REQUESTED_FROM_CLIENT", "FINAL_SUBMITTED_TO_CLIENT"].includes(request.currentStatus)) return "Client";

    if (["FORWARDED_TO_TMS", "ENGINEERING_REVISION_REQUESTED", "TMS_MEMBER_INFO_REQUESTED", "TMS_ASSIGNED", "DRAWING_IN_PROGRESS", "CHECKING_REVIEW", "APPROVAL_REVIEW", "ENGINEERING_LEAD_REVIEW"].includes(request.currentStatus)) {
      if (request.currentStatus === "CHECKING_REVIEW") return getMemberName(request.tmsAssignments?.checkingId);
      if (request.currentStatus === "APPROVAL_REVIEW") return getMemberName(request.tmsAssignments?.approvalId);
      if (request.currentStatus === "DRAWING_IN_PROGRESS" || request.currentStatus === "TMS_ASSIGNED") return getMemberName(request.tmsAssignments?.drawingId) || "TMS";
      return "TMS Engineering Lead";
    }

    if (["MEMBER_REVIEW", "MEMBER_INFO_REQUESTED", "PM_LEAD_RESPONDED", "PM_REWORK_REQUESTED"].includes(request.currentStatus)) return getMemberName(request.assignedMemberId);
    if (["DIVISION_NOTIFIED", "LEADER_ASSIGNED", "MARKETING_INFO_PROVIDED", "PM_MEMBER_SUBMITTED", "ENGINEERING_REVISION_REQUESTED"].includes(request.currentStatus)) {
      return getMemberName(request.assignedLeaderId) !== "—" ? getMemberName(request.assignedLeaderId) : `${getDivision(request.assignedDivisionId)?.abbr || "PM"} Lead`;
    }

    return getDivision(request.assignedDivisionId)?.abbr || "—";
  };

  const openActionModal = (request: WorkRequest) => {
    const tmsMembers = state.members.filter((member) => member.divisionId === "div-tms-eng" && !/manager|lead|leader/i.test(member.roleTitle));

    setActionFiles([]);
    setActionDoc(createEmptyDocumentRow(request.attachmentCategory || request.category || state.settings.categories[0] || "General", getDefaultActionUploadStage(request.currentStatus)));
    setTmsChoice({
      drawingId: request.tmsAssignments?.drawingId || tmsMembers[0]?.id || "",
      checkingId: request.tmsAssignments?.checkingId || tmsMembers[1]?.id || tmsMembers[0]?.id || "",
      approvalId: request.tmsAssignments?.approvalId || tmsMembers[2]?.id || tmsMembers[0]?.id || "",
    });
    const infoTargets = getInfoTargetOptions(request);
    setInfoTargetChoice(infoTargets[0]?.id || "");
    setSelectedPackageFileIds(getFinalPackageFiles(request).map((file) => file.id));
    setActionDisplayChoice("");
    setActionRequestId(request.id);
  };

  useEffect(() => {
    if (!routeSearch.requestId) return;

    const routeKey = `${routeSearch.requestId}:${routeSearch.view || "details"}`;
    if (appliedNotificationRouteRef.current === routeKey) return;

    const targetRequest = state.workRequests.find((request) => request.id === routeSearch.requestId);
    if (!targetRequest) return;

    appliedNotificationRouteRef.current = routeKey;

    setSearch("");
    setExpandedId(targetRequest.id);
    setExpandedParentIds((prev) => (prev.includes(targetRequest.parentId) ? prev : [...prev, targetRequest.parentId]));

    setDetailRequestId(null);
    setHistoryRequestId(null);
    setUploadRequestId(null);
    setActionRequestId(null);

    window.setTimeout(() => {
      document.getElementById(`work-request-${targetRequest.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    if (routeSearch.view === "history") {
      setHistoryMode("TRANSFER");
      setHistoryRequestId(targetRequest.id);
      return;
    }

    if (routeSearch.view === "upload") {
      setUploadRequestId(targetRequest.id);
      return;
    }

    if (routeSearch.view === "focus" || routeSearch.view === "action") {
      if (!hasWorkflowAction(targetRequest)) {
        setDetailRequestId(targetRequest.id);
      }

      return;
    }

    setDetailRequestId(targetRequest.id);
  }, [routeSearch.requestId, routeSearch.view, state.workRequests]);

  const handleCreate = () => {
    if (!createForm.title.trim()) return toast.error("Work request title is required");
    if (!createForm.parentId) return toast.error("A parent Bid/Project is required before creating a work request");

    addWorkRequest(createForm);
    toast.success("Work request created and routed to division");
    setShowCreate(false);
    setCreateForm({
      parentType: "BID",
      parentId: state.projects.find((project) => project.type === "BID" && project.status !== "ARCHIVED")?.id || "",
      title: "",
      category: workRequestTypes[0] || "General",
      priority: "High",
      attachmentCategory: projectInfoCategories[0] || "General",
      notes: "",
      assignedDivisionId: "div-ecm",
    });
  };

  const createRowsFromFiles = async (files?: FileList | null) => {
    if (!files?.length) return [];

    return Promise.all(
      Array.from(files).map(async (file) => {
        const fileDataUrl = await readFileAsDataUrl(file);

        return {
          name: file.name,
          category: state.settings.categories[0] || "General",
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileDataUrl,
          workflowStage: "Workflow Collaboration",
          note: "",
        } satisfies DocumentFormRow;
      })
    );
  };

  const handleUploadFileChange = async (files?: FileList | null) => {
    try {
      const rows = await createRowsFromFiles(files);
      if (!rows.length) return;
      setUploadFiles((prev) => [...prev, ...rows]);
    } catch {
      toast.error("Could not read selected file(s)");
    }
  };

  const handleActionFileChange = async (files?: FileList | null) => {
    try {
      const rows = await createRowsFromFiles(files);
      if (!rows.length) return;
      setActionFiles((prev) => [...prev, ...rows]);
    } catch {
      toast.error("Could not read selected file(s)");
    }
  };

  const uploadUpdatedDocument = (request: WorkRequest) => {
    const note = uploadDoc.note?.trim() || "";
    const fileDocuments = uploadFiles
      .map((fileDoc) =>
        normalizeDocument({
          ...fileDoc,
          category: request.attachmentCategory || request.category,
          workflowStage: getDefaultActionUploadStage(request.currentStatus),
          note,
          textContent: undefined,
        })
      )
      .filter(Boolean) as DocumentFormRow[];

    if (!fileDocuments.length) {
      if (note) {
        addWorkRequestNote(request.id, note, "Added workflow note");
        toast.success("Note added to history");
        setUploadDoc(createEmptyDocumentRow(request.attachmentCategory || request.category, getDefaultActionUploadStage(request.currentStatus)));
        setUploadRequestId(null);
        return;
      }

      return toast.error("Upload at least one file or add a note before submitting");
    }

    fileDocuments.forEach((document) => addWorkRequestDocument(request.id, document));
    toast.success("Document uploaded", {
      description: `${fileDocuments.length} file(s) uploaded. Same file names are saved as a new version.`,
    });

    setUploadFiles([]);
    setUploadDoc(createEmptyDocumentRow(request.attachmentCategory || request.category, getDefaultActionUploadStage(request.currentStatus)));
    setUploadRequestId(null);
  };

  const uploadOptionalActionDocument = (request: WorkRequest, fallbackStage: string) => {
    const stage = fallbackStage;
    const category = request.attachmentCategory || request.category;
    const note = actionDoc.note?.trim() || "";
    const fileDocuments = actionFiles
      .map((fileDoc) =>
        normalizeDocument({
          ...fileDoc,
          category,
          workflowStage: stage,
          note,
          textContent: undefined,
        })
      )
      .filter(Boolean) as DocumentFormRow[];

    if (!fileDocuments.length) return false;

    fileDocuments.forEach((document) => addWorkRequestDocument(request.id, document));
    setActionFiles([]);
    setActionDoc(createEmptyDocumentRow(category, fallbackStage));
    return true;
  };

  const runWorkflowAction = (request: WorkRequest, message: string, fallbackStage: string, action: () => void) => {
    const attachmentOnlyNote = !actionFiles.length ? actionDoc.note?.trim() || "" : "";
    const attached = uploadOptionalActionDocument(request, fallbackStage);
    action();
    if (attachmentOnlyNote) addWorkRequestNote(request.id, attachmentOnlyNote, "Added action note");
    setActionNotes({});
    setActionDoc(createEmptyDocumentRow(request.attachmentCategory || request.category, fallbackStage));
    toast.success(message, {
      description: attached ? "Optional file(s) attached. Same file names are saved as a new version." : undefined,
    });
  };

  const openFinalListingFromAction = (request: WorkRequest) => {
    uploadOptionalActionDocument(request, "HML Registry");
    setListDocForm({
      name: request.drawingDocumentName || `${request.title} Final`,
      category: request.attachmentCategory,
    });
    setShowListDialog(request.id);
  };

  const renderFileCard = (doc: AttachmentRef) => (
    <div key={doc.id} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium text-card-foreground">{doc.name}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">v{doc.version || 1}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {getFileTypeLabel(getFileTypeKey(doc))}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {getAttachmentFileGroup(doc) === "PRIMARY" ? "Primary" : "Workflow"}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {doc.category} · {doc.workflowStage || "Workflow Collaboration"} · Uploaded by {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
          </p>

          {doc.fileName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              File: {doc.fileName} · {formatFileSize(doc.fileSize)}
            </p>
          ) : null}

          {doc.textContent ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{doc.textContent}</p> : null}
          {doc.note ? (
            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">Revision / File Message</p>
              <p className="mt-1 whitespace-pre-wrap">{doc.note}</p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewFile(doc)}>
            <Eye className="h-4 w-4" /> View
          </Button>

          <Button variant="outline" size="sm" onClick={() => void downloadAttachment(doc)}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
    </div>
  );

  const renderRevisionGroupCard = (group: ReturnType<typeof getDocumentRevisionGroups>[number]) => (
    <div key={group.key} className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h4 className="truncate font-semibold text-card-foreground">{group.name}</h4>
        </div>
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {group.revisions.length} version{group.revisions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {group.revisions.map((doc, index) => (
          <div key={doc.id} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary">
                    v{doc.version || index + 1}
                  </span>
                  <p className="font-medium text-card-foreground">{doc.fileName || doc.name}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {getFileTypeLabel(getFileTypeKey(doc))}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {getAttachmentFileGroup(doc) === "PRIMARY" ? "Primary" : "Workflow"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.category} · {doc.workflowStage || "Workflow Collaboration"} · Uploaded by {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
                </p>

                {doc.fileName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    File: {doc.fileName} · {formatFileSize(doc.fileSize)}
                  </p>
                ) : null}

                {doc.note ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">Revision / File Message</p>
                    <p className="mt-1 whitespace-pre-wrap">{doc.note}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewFile(doc)}>
                  <Eye className="h-4 w-4" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={() => void downloadAttachment(doc)}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTransferFileCard = (doc: AttachmentRef, selectable = false) => {
    const checked = selectedPackageFileIds.includes(doc.id);

    return (
      <div key={doc.id} className="rounded-lg border border-border bg-background p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-3">
            {selectable ? (
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  setSelectedPackageFileIds((prev) =>
                    event.target.checked ? [...new Set([...prev, doc.id])] : prev.filter((id) => id !== doc.id)
                  );
                }}
                className="mt-1 h-4 w-4 cursor-pointer"
              />
            ) : null}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-card-foreground">{doc.name}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">v{doc.version || 1}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {getFileTypeLabel(getFileTypeKey(doc))}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {doc.workflowStage || "Workflow Collaboration"} · Uploaded by {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
              </p>
              {doc.fileName ? <p className="mt-1 text-xs text-muted-foreground">{doc.fileName} · {formatFileSize(doc.fileSize)}</p> : null}
              {doc.note ? (
                <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">File Message</p>
                  <p className="mt-1 whitespace-pre-wrap">{doc.note}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewFile(doc)}>
              <Eye className="h-4 w-4" /> View
            </Button>
            <Button variant="outline" size="sm" onClick={() => void downloadAttachment(doc)}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderActionPackageSection = (request: WorkRequest) => {
    const isMarketingReview = request.currentStatus === "FINAL_SUBMITTED_TO_MARKETING";
    const isClientReview = request.currentStatus === "FINAL_SUBMITTED_TO_CLIENT";
    const isClientRevision = request.currentStatus === "CLIENT_REVISION_REQUESTED";

    if (!isMarketingReview && !isClientReview && !isClientRevision) return null;

    const files = isClientRevision ? getClientRevisionFiles(request) : getFinalPackageFiles(request);
    if (!files.length) return null;

    const selectable = isMarketingReview;
    const title = isClientRevision
      ? "Client Uploaded Revision File(s)"
      : isClientReview
        ? "Final Package Sent to Client"
        : "Final Engineering Package from TMS Lead";

    const description = isClientRevision
      ? "Only the file(s) uploaded by the client for this revision request are shown here."
      : selectable
        ? "These files are pre-selected for client delivery. You can view/download them, unselect any file, and upload additional files below before submitting."
        : "These files were submitted by CCR / Marketing for client review. The client can view and download them before accepting, rejecting, or requesting revision.";

    return (
      <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div>
          <h4 className="text-sm font-semibold text-card-foreground">{title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-2">
          {files.map((file) => renderTransferFileCard(file, selectable))}
        </div>
      </div>
    );
  };

  const renderSelectedFiles = (files: DocumentFormRow[], onRemove: (index: number) => void) => {
    if (!files.length) return null;

    return (
      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-medium text-muted-foreground">Selected file(s)</p>
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={`${file.fileName}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-foreground">
                {file.fileName} · {formatFileSize(file.fileSize)}
              </span>
              <button type="button" className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => onRemove(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFeedbackMessageCard = (entry: WorkRequest["revisionHistory"][number], compact = false) => (
    <div key={entry.id} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">
            {compact ? "Request / Response Message" : "Revision / Request Message"}
          </p>
          <p className="mt-1 font-semibold text-card-foreground">{entry.action}</p>
        </div>
        <p className="text-xs text-rose-700 dark:text-rose-200">{formatDate(entry.at)}</p>
      </div>

      <p className="mt-2 whitespace-pre-wrap leading-relaxed">{entry.note}</p>

      <p className="mt-2 text-xs text-rose-700 dark:text-rose-200">
        {entry.by}
        {entry.to ? (
          <>
            {" "}
            <ArrowRight className="mx-1 inline h-3 w-3" /> {entry.to}
          </>
        ) : null}
      </p>
    </div>
  );

  const renderDocumentMessageCard = (doc: AttachmentRef) => (
    <div key={`doc-message-${doc.id}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
            File Note / Text Document
          </p>
          <p className="mt-1 font-semibold text-card-foreground">{doc.name}</p>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-200">{formatDate(doc.uploadedAt)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-200">
        <span>{doc.fileName || "Text document"}</span>
        <span>v{doc.version || 1}</span>
        <span>{doc.workflowStage || "Workflow Collaboration"}</span>
        <span>Uploaded by {doc.uploadedBy}</span>
      </div>

      {doc.note?.trim() ? (
        <div className="mt-3 rounded-lg border border-amber-200/80 bg-background/70 px-3 py-2 dark:border-amber-900/50 dark:bg-background/40">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Note</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{doc.note}</p>
        </div>
      ) : null}

      {doc.textContent?.trim() ? (
        <div className="mt-3 rounded-lg border border-amber-200/80 bg-background/70 px-3 py-2 dark:border-amber-900/50 dark:bg-background/40">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Text Document</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{doc.textContent}</p>
        </div>
      ) : null}
    </div>
  );

  const renderActionFeedbackMessages = (request: WorkRequest) => {
    const messages = getPendingActionFeedbackMessages(request);

    if (!messages.length) return null;

    return (
      <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
        <div>
          <h4 className="text-sm font-semibold text-card-foreground">Latest Incoming Message</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Only the most recent message from the person/team that sent this work to you is shown here.
          </p>
        </div>

        <div className="space-y-3">
          {messages.map((entry) => renderFeedbackMessageCard(entry, true))}
        </div>
      </div>
    );
  };

  const renderStandaloneRevisionMessages = (request: WorkRequest) => {
    const messages = getStandaloneRevisionMessages(request);
    if (!messages.length) return null;

    return (
      <div>
        <h4 className="text-sm font-semibold text-card-foreground">Revision / Request Messages</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Messages without directly attached files are listed here. File-specific messages are shown below their file names.
        </p>

        <div className="mt-3 space-y-3">
          {messages.map((entry) => renderFeedbackMessageCard(entry))}
        </div>
      </div>
    );
  };

  const renderOptionalActionUploadFields = () => (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-card-foreground">Optional Action Attachment</h4>
        <p className="text-xs text-muted-foreground">
          Attach one or more files for this workflow action. Optional notes are saved with the uploaded file(s) and in history.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload File(s)</label>
          <input
            type="file"
            multiple
            onChange={(event) => void handleActionFileChange(event.target.files)}
            className="w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
          />
          <p className="mt-1 text-xs text-muted-foreground">You can select multiple files at once.</p>
        </div>

        <div className="md:col-span-2">
          {renderSelectedFiles(actionFiles, (index) => setActionFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index)))}
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Attachment Note</label>
          <input
            value={actionDoc.note || ""}
            onChange={(event) => setActionDoc((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Optional note for attached file(s). Saved with the file and in history."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
  const renderActionPanel = (request: WorkRequest) => {
    const memberOptions = getMemberOptions(request.assignedDivisionId);
    const tmsMemberOptions = state.members.filter((member) => member.divisionId === "div-tms-eng" && !/manager|lead|leader/i.test(member.roleTitle));

    const canMarketingReturnPm = canPerformAction(request, "MARKETING_RETURN_PM");
    const canMarketingEscalateClient = canPerformAction(request, "MARKETING_ESCALATE_CLIENT");
    const canClientProvideInfo = canPerformAction(request, "CLIENT_PROVIDE_INFO");
    const canPmRespondMember = canPerformAction(request, "PM_RESPOND_MEMBER");
    const canPmMemberSubmit = canPerformAction(request, "PM_MEMBER_SUBMIT");
    const canPmReturnMember = canPerformAction(request, "PM_RETURN_MEMBER");
    const canAssignMember = canPerformAction(request, "ASSIGN_MEMBER");
    const canForward = canPerformAction(request, "FORWARD_TO_TMS");
    const canEngineeringRequestPmRevision = canPerformAction(request, "ENGINEERING_REQUEST_PM_REVISION");
    const canEngineeringRequestTmsRevision = canPerformAction(request, "ENGINEERING_REQUEST_TMS_REVISION");
    const canTmsLeadRespondMember = canPerformAction(request, "TMS_LEAD_RESPOND_MEMBER");
    const canEngineeringSubmitMarketing = canPerformAction(request, "ENGINEERING_SUBMIT_MARKETING");
    const canMarketingSubmitClient = canPerformAction(request, "MARKETING_SUBMIT_CLIENT");
    const canMarketingRequestEngineeringRevision = canPerformAction(request, "MARKETING_REQUEST_ENGINEERING_REVISION");
    const canMarketingSubmitClientRevision = canPerformAction(request, "MARKETING_SUBMIT_CLIENT_REVISION");
    const canMarketingRouteClientRevisionTms = canPerformAction(request, "MARKETING_ROUTE_CLIENT_REVISION_TMS");
    const canClientAcceptFinal = canPerformAction(request, "CLIENT_ACCEPT_FINAL");
    const canClientRejectFinal = canPerformAction(request, "CLIENT_REJECT_FINAL");
    const canClientRequestRevision = canPerformAction(request, "CLIENT_REQUEST_REVISION");
    const canMarketingRouteClientRevisionPm = canPerformAction(request, "MARKETING_ROUTE_CLIENT_REVISION_PM");
    const canAssignTms = canPerformAction(request, "ASSIGN_TMS_CHAIN");
    const canSubmitDrawing = canPerformAction(request, "SUBMIT_DRAWING");
    const canCheck = canPerformAction(request, "CHECKING_APPROVE_REJECT");
    const canApprove = canPerformAction(request, "APPROVAL_APPROVE_REJECT");
    const canOriginMember = canPerformAction(request, "DIVISION_MEMBER_REVIEW");
    const canOriginManager = canPerformAction(request, "DIVISION_MANAGER_APPROVE");
    const canForwardToCcr = canPerformAction(request, "FORWARD_TO_CCR");
    const canList = canPerformAction(request, "FINAL_LIST");
    const canRequestInfo = canPerformAction(request, "REQUEST_INFO");
    const canRespondInfo = canPerformAction(request, "RESPOND_INFO");
    const infoTargetOptions = getInfoTargetOptions(request);
    const selectedInfoTarget = infoTargetOptions.find((option) => option.id === infoTargetChoice) || infoTargetOptions[0];

    const hasActions =
      canMarketingReturnPm ||
      canMarketingEscalateClient ||
      canClientProvideInfo ||
      canPmRespondMember ||
      canPmMemberSubmit ||
      canPmReturnMember ||
      canAssignMember ||
      canForward ||
      canEngineeringRequestPmRevision ||
      canEngineeringRequestTmsRevision ||
      canTmsLeadRespondMember ||
      canEngineeringSubmitMarketing ||
      canMarketingSubmitClient ||
      canMarketingRequestEngineeringRevision ||
      canMarketingSubmitClientRevision ||
      canMarketingRouteClientRevisionTms ||
      canClientAcceptFinal ||
      canClientRejectFinal ||
      canClientRequestRevision ||
      canMarketingRouteClientRevisionPm ||
      canAssignTms ||
      canSubmitDrawing ||
      canCheck ||
      canApprove ||
      canOriginMember ||
      canOriginManager ||
      canForwardToCcr ||
      canList ||
      canRequestInfo ||
      canRespondInfo;

    const actionOptions = [
      canRespondInfo ? "Respond to Request Info" : null,
      canRequestInfo ? "Request Info" : null,
      canMarketingReturnPm ? "Return Updated Info to PM Lead" : null,
      canMarketingEscalateClient ? "Escalate Information Request to Client" : null,
      canClientProvideInfo ? "Provide Requested Information" : null,
      canAssignMember ? "Assign PM Team Member" : null,
      canPmRespondMember ? "Respond to Team Member" : null,
      canPmMemberSubmit ? "Submit Work to PM Lead" : null,
      canPmReturnMember ? "Return to PM Member for Fixes" : null,
      canForward ? "Forward to TMS Engineering Lead" : null,
      canEngineeringRequestPmRevision ? "Request Revision from PM Lead" : null,
      canEngineeringRequestTmsRevision ? "Request Internal TMS Revision" : null,
      canTmsLeadRespondMember ? "Respond to TMS Member" : null,
      canAssignTms ? "Assign TMS Engineering Members" : null,
      canSubmitDrawing ? "Submit Drawing - M1" : null,
      canCheck ? "Checking Review - M2" : null,
      canApprove ? "TMS Approval - M3" : null,
      canEngineeringSubmitMarketing ? "Submit Final to CCR / Marketing" : null,
      canMarketingSubmitClient ? "Submit Final to Client" : null,
      canMarketingRequestEngineeringRevision ? "Request Revision from Engineering" : null,
      canClientAcceptFinal ? "Accept Final Delivery" : null,
      canClientRejectFinal ? "Reject Final Delivery" : null,
      canClientRequestRevision ? "Request Client Revision" : null,
      canMarketingSubmitClientRevision ? "Send Revision Response to Client" : null,
      canMarketingRouteClientRevisionTms ? "Route Client Revision to TMS Manager" : null,
      canMarketingRouteClientRevisionPm ? "Route Client Revision to PM Lead" : null,
      canOriginMember ? "Legacy Division Member Review" : null,
      canOriginManager ? "Legacy Division Manager Approval" : null,
      canForwardToCcr ? "Legacy Forward to CCR" : null,
      canList ? "Legacy Merge / Final HML Listing" : null,
    ].filter(Boolean) as string[];
    const selectedActionTitle = actionOptions.includes(actionDisplayChoice) ? actionDisplayChoice : actionOptions[0] || "";

    if (!hasActions) {
      return (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No workflow action is available for your current role at this stage.
        </div>
      );
    }

    const getActionNote = (key: WorkflowAction) => actionNotes[key] || "";
    const updateActionNote = (key: WorkflowAction, value: string) => {
      setActionNotes((prev) => ({ ...prev, [key]: value }));
    };

    const renderNote = (key: WorkflowAction, placeholder: string) => (
      <textarea
        value={getActionNote(key)}
        onChange={(event) => updateActionNote(key, event.target.value)}
        placeholder={placeholder}
        className="h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    );

    const actionCard = (title: string, description: string, children: ReactNode, important = false) => {
      if (selectedActionTitle && title !== selectedActionTitle) return null;

      return (
        <div className={`space-y-3 rounded-xl border p-4 ${important ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20" : "border-border bg-background"}`}>
          <div>
            <h4 className="text-sm font-semibold text-card-foreground">{title}</h4>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {children}
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-card-foreground">Current Workflow Position</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {getWorkRequestStatusLabel(request.currentStatus)} · Handler: {getCurrentHandler(request)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Linear chain: Client ↔ CCR / Marketing ↔ ECM/PMO Lead ↔ ECM/PMO Member ↔ TMS Engineering Lead ↔ TMS-M1/M2/M3.
          </p>
        </div>

        {actionOptions.length > 1 ? (
          <div className="rounded-xl border border-border bg-background p-4">
            <h4 className="text-sm font-semibold text-card-foreground">Choose Action</h4>
            <p className="mt-1 text-xs text-muted-foreground">Only the selected action panel is shown below.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {actionOptions.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${selectedActionTitle === option ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"}`}
                >
                  <input
                    type="radio"
                    name={`workflow-action-${request.id}`}
                    value={option}
                    checked={selectedActionTitle === option}
                    onChange={() => setActionDisplayChoice(option)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-medium">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {canRespondInfo &&
            actionCard(
              "Respond to Request Info",
              `Information was requested by ${request.pendingInfoRequest?.requestedBy || "the previous handler"}. Replying here does not change the main workflow stage.`,
              <>
                {request.pendingInfoRequest?.note ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="text-[10px] font-bold uppercase tracking-wide">Requested Info</p>
                    <p className="mt-1 whitespace-pre-wrap">{request.pendingInfoRequest.note}</p>
                  </div>
                ) : null}
                {renderNote("RESPOND_INFO", "Reply with the requested information")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "Requested information provided", "Information Response", () => respondWorkflowInfo(request.id, getActionNote("RESPOND_INFO")))}>
                  <Send className="h-4 w-4" /> Send Info Response
                </Button>
              </>,
              true
            )}

          {canRequestInfo &&
            actionCard(
              "Request Info",
              "Ask a previous handler or responsible lead/member for information without sending the workflow back for revision.",
              <>
                <select
                  value={infoTargetChoice || selectedInfoTarget?.id || ""}
                  onChange={(event) => setInfoTargetChoice(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {infoTargetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {renderNote("REQUEST_INFO", "What information do you need?")}
                <Button
                  className="w-full"
                  onClick={() => {
                    const target = infoTargetOptions.find((option) => option.id === (infoTargetChoice || selectedInfoTarget?.id)) || selectedInfoTarget;
                    if (!target) {
                      toast.error("Select a request info target first");
                      return;
                    }
                    runWorkflowAction(request, "Information requested", "Information Request", () =>
                      requestWorkflowInfo(request.id, {
                        targetLabel: target.label,
                        targetRole: target.targetRole,
                        targetMemberId: target.targetMemberId,
                        targetClientId: target.targetClientId,
                        note: getActionNote("REQUEST_INFO"),
                      })
                    );
                  }}
                >
                  <Send className="h-4 w-4" /> Request Info
                </Button>
              </>,
              true
            )}

          {canMarketingReturnPm &&
            actionCard(
              "Return Updated Info to PM Lead",
              "CCR / Marketing resolved the request and sends the updated information back to PM Lead.",
              <>
                {renderNote("MARKETING_RETURN_PM", "Summary of resolved information / update")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "Updated information returned to PM lead", "Marketing / Client Clarification", () => marketingReturnToPm(request.id, getActionNote("MARKETING_RETURN_PM")))}>
                  <Send className="h-4 w-4" /> Send to PM Lead
                </Button>
              </>,
              true
            )}

          {canMarketingEscalateClient &&
            actionCard(
              "Escalate Information Request to Client",
              "Use this only when CCR / Marketing cannot resolve the issue internally.",
              <>
                {renderNote("MARKETING_ESCALATE_CLIENT", "Information required from client")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "Information request escalated to client", "Marketing / Client Clarification", () => marketingEscalateToClient(request.id, getActionNote("MARKETING_ESCALATE_CLIENT")))}>
                  <Send className="h-4 w-4" /> Escalate to Client
                </Button>
              </>,
              true
            )}

          {canClientProvideInfo &&
            actionCard(
              "Provide Requested Information",
              "Client provides requested data back to CCR / Marketing.",
              <>
                {renderNote("CLIENT_PROVIDE_INFO", "Client response / data note")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "Client information provided to CCR / Marketing", "Marketing / Client Clarification", () => clientProvideInfo(request.id, getActionNote("CLIENT_PROVIDE_INFO")))}>
                  <Send className="h-4 w-4" /> Provide Information
                </Button>
              </>,
              true
            )}

          {canAssignMember &&
            actionCard(
              "Assign PM Team Member",
              "After verification, assign the request to the responsible ECM/PMO member.",
              <>
                <select
                  value={memberChoice}
                  onChange={(event) => setMemberChoice(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select member</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!memberChoice) return toast.error("Select a PM team member first");
                    runWorkflowAction(request, "PM team member assigned", "PM Member Work", () => assignMember(request.id, memberChoice));
                    setMemberChoice("");
                  }}
                >
                  Assign Member
                </Button>
              </>
            )}

          {canPmRespondMember &&
            actionCard(
              "Respond to Team Member",
              "PM Lead answers the member query and returns guidance.",
              <>
                {renderNote("PM_RESPOND_MEMBER", "PM Lead response / instruction")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "PM lead responded to team member", "PM Member Work", () => pmLeadRespondToMember(request.id, getActionNote("PM_RESPOND_MEMBER")))}>
                  <Send className="h-4 w-4" /> Send Response
                </Button>
              </>,
              true
            )}

          {canPmMemberSubmit &&
            actionCard(
              "Submit Work to PM Lead",
              "Submit the prepared work package for PM Lead internal quality control.",
              <>
                {renderNote("PM_MEMBER_SUBMIT", "Submission note")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "PM member submitted work to PM lead", "PM Lead Quality Control", () => pmMemberSubmit(request.id, getActionNote("PM_MEMBER_SUBMIT")))}>
                  <Send className="h-4 w-4" /> Submit Work
                </Button>
              </>
            )}

          {canPmReturnMember &&
            actionCard(
              "Return to PM Member for Fixes",
              "PM Lead requests fixes before forwarding to Engineering.",
              <>
                {renderNote("PM_RETURN_MEMBER", "Fix / rework instruction")}
                <Button variant="destructive" className="w-full" onClick={() => runWorkflowAction(request, "PM lead returned work for fixes", "PM Lead Quality Control", () => pmReturnToMember(request.id, getActionNote("PM_RETURN_MEMBER")))}>
                  <XCircle className="h-4 w-4" /> Request Fixes
                </Button>
              </>,
              true
            )}

          {canForward &&
            actionCard(
              "Forward to TMS Engineering Lead",
              "PM Lead approves the internal work package and sends it to Engineering.",
              <>
                {renderNote("FORWARD_TO_TMS", "Engineering forwarding note")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "Forwarded to TMS Engineering Lead", "TMS Manager Assignment", () => forwardToTms(request.id, getActionNote("FORWARD_TO_TMS")))}>
                  <Send className="h-4 w-4" /> Forward to Engineering
                </Button>
              </>
            )}

          {canEngineeringRequestPmRevision &&
            actionCard(
              "Request Revision from PM Lead",
              "Engineering Lead requests correction or clarification from PM before assigning Engineering members.",
              <>
                {renderNote("ENGINEERING_REQUEST_PM_REVISION", "Engineering discrepancy / revision request")}
                <Button variant="destructive" className="w-full" onClick={() => runWorkflowAction(request, "Engineering requested revision from PM Lead", "TMS Manager Assignment", () => engineeringRequestPmRevision(request.id, getActionNote("ENGINEERING_REQUEST_PM_REVISION")))}>
                  <XCircle className="h-4 w-4" /> Request PM Revision
                </Button>
              </>,
              true
            )}

          {canEngineeringRequestTmsRevision &&
            actionCard(
              "Request Internal TMS Revision",
              "After TMS-M3 approval, Engineering Lead can return the package to TMS-M1. The normal M1 → M2 → M3 → Manager chain will run again.",
              <>
                {renderNote("ENGINEERING_REQUEST_TMS_REVISION", "Internal TMS revision instruction")}
                <Button variant="destructive" className="w-full" onClick={() => runWorkflowAction(request, "TMS internal revision requested", "Engineering Lead Final Review", () => engineeringRequestTmsRevision(request.id, getActionNote("ENGINEERING_REQUEST_TMS_REVISION")))}>
                  <XCircle className="h-4 w-4" /> Request TMS Revision
                </Button>
              </>,
              true
            )}

          {canTmsLeadRespondMember &&
            actionCard(
              "Respond to TMS Member",
              "Engineering Lead answers the member query and returns the task to the same technical stage.",
              <>
                {renderNote("TMS_LEAD_RESPOND_MEMBER", "Engineering Lead response / instruction")}
                <Button className="w-full" onClick={() => runWorkflowAction(request, "TMS Engineering Lead responded to member", getDefaultActionUploadStage(request.currentStatus), () => tmsLeadRespondToMember(request.id, getActionNote("TMS_LEAD_RESPOND_MEMBER")))}>
                  <Send className="h-4 w-4" /> Send Response
                </Button>
              </>,
              true
            )}

          {canAssignTms &&
            actionCard(
              "Assign TMS Engineering Members",
              "Assign M1 Drawing, M2 Checking, and M3 Approval responsibilities.",
              <>
                <select value={tmsChoice.drawingId} onChange={(event) => setTmsChoice((prev) => ({ ...prev, drawingId: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {tmsMemberOptions.map((member) => (
                    <option key={member.id} value={member.id} disabled={member.id === tmsChoice.checkingId || member.id === tmsChoice.approvalId}>M1 Drawing — {member.name}</option>
                  ))}
                </select>
                <select value={tmsChoice.checkingId} onChange={(event) => setTmsChoice((prev) => ({ ...prev, checkingId: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {tmsMemberOptions.map((member) => (
                    <option key={member.id} value={member.id} disabled={member.id === tmsChoice.drawingId || member.id === tmsChoice.approvalId}>M2 Checking — {member.name}</option>
                  ))}
                </select>
                <select value={tmsChoice.approvalId} onChange={(event) => setTmsChoice((prev) => ({ ...prev, approvalId: event.target.value }))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {tmsMemberOptions.map((member) => (
                    <option key={member.id} value={member.id} disabled={member.id === tmsChoice.drawingId || member.id === tmsChoice.checkingId}>M3 Approval — {member.name}</option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!tmsChoice.drawingId || !tmsChoice.checkingId || !tmsChoice.approvalId) {
                      toast.error("Select M1, M2, and M3 members first");
                      return;
                    }

                    const uniqueTmsMembers = new Set([tmsChoice.drawingId, tmsChoice.checkingId, tmsChoice.approvalId]);
                    if (uniqueTmsMembers.size !== 3) {
                      toast.error("M1, M2, and M3 must be three different members");
                      return;
                    }

                    runWorkflowAction(request, "TMS engineering members assigned", "TMS Manager Assignment", () => assignTmsChain(request.id, tmsChoice));
                  }}
                >
                  Assign Engineering Members
                </Button>
              </>
            )}

          {canSubmitDrawing &&
            actionCard(
              "Submit Drawing - M1",
              "Attach the drawing file(s) above, then submit the package to M2 Checking.",
              <>
                <Button
                  className="w-full"
                  onClick={() => {
                    const packageName = actionFiles[0]?.fileName || actionFiles[0]?.name || request.drawingDocumentName || `${request.title} M1 Drawing Package`;
                    runWorkflowAction(request, "Drawing submitted", "TMS Drawing - M1", () => submitDrawing(request.id, packageName));
                  }}
                >
                  Submit Drawing
                </Button>
              </>
            )}

          {canCheck &&
            actionCard("Checking Review - M2", "Approve the drawing or return it to M1 for correction.", <>
              {renderNote("CHECKING_APPROVE_REJECT", "Checking note")}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => runWorkflowAction(request, "Checking approved", "TMS Checking - M2", () => reviewChecking(request.id, true, getActionNote("CHECKING_APPROVE_REJECT")))}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                <Button variant="destructive" className="flex-1" onClick={() => runWorkflowAction(request, "Checking returned to drawing", "TMS Checking - M2", () => reviewChecking(request.id, false, getActionNote("CHECKING_APPROVE_REJECT")))}><XCircle className="h-4 w-4" />Reject</Button>
              </div>
            </>)}

          {canApprove &&
            actionCard("TMS Approval - M3", "Approve the package or return it to M1 drawing for revision.", <>
              {renderNote("APPROVAL_APPROVE_REJECT", "Approval note")}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => runWorkflowAction(request, "TMS-M3 approved and sent to Engineering Lead", "TMS Approval - M3", () => reviewApproval(request.id, true, getActionNote("APPROVAL_APPROVE_REJECT")))}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                <Button variant="destructive" className="flex-1" onClick={() => runWorkflowAction(request, "TMS-M3 returned to drawing", "TMS Approval - M3", () => reviewApproval(request.id, false, getActionNote("APPROVAL_APPROVE_REJECT")))}><XCircle className="h-4 w-4" />Reject</Button>
              </div>
            </>)}

          {canEngineeringSubmitMarketing &&
            actionCard("Submit Final to CCR / Marketing", "Engineering Lead submits the final engineering package to CCR / Marketing.", <>
              {renderNote("ENGINEERING_SUBMIT_MARKETING", "Final engineering release note")}
              <Button className="w-full" onClick={() => { const uploadKeys = getActionUploadFileKeys(); runWorkflowAction(request, "Final engineering package submitted to CCR / Marketing", "Engineering Lead Final Review", () => engineeringSubmitToMarketing(request.id, getActionNote("ENGINEERING_SUBMIT_MARKETING"), uploadKeys)); }}><Send className="h-4 w-4" /> Submit to CCR</Button>
            </>)}

          {canMarketingSubmitClient &&
            actionCard("Submit Final to Client", "CCR / Marketing reviews and sends the final delivery to the Client.", <>
              {renderNote("MARKETING_SUBMIT_CLIENT", "Client delivery note")}
              <Button className="w-full" onClick={() => { const uploadKeys = getActionUploadFileKeys(); runWorkflowAction(request, "Final package submitted to Client", "Marketing Final Delivery", () => marketingSubmitToClient(request.id, getActionNote("MARKETING_SUBMIT_CLIENT"), selectedPackageFileIds, uploadKeys)); }}><Send className="h-4 w-4" /> Submit to Client</Button>
            </>)}

          {canMarketingRequestEngineeringRevision &&
            actionCard("Request Revision from Engineering", "CCR / Marketing found an issue in the final package and sends it back to Engineering Lead for revision.", <>
              {renderNote("MARKETING_REQUEST_ENGINEERING_REVISION", "Revision request note")}
              <Button variant="destructive" className="w-full" onClick={() => runWorkflowAction(request, "CCR / Marketing requested engineering revision", "Marketing Final Delivery", () => marketingRequestEngineeringRevision(request.id, getActionNote("MARKETING_REQUEST_ENGINEERING_REVISION")))}><XCircle className="h-4 w-4" /> Request Revision</Button>
            </>, true)}

          {canClientAcceptFinal &&
            actionCard("Accept Final Delivery", "Accept the final delivery and move the accepted item into Client Pending.", <>
              {renderNote("CLIENT_ACCEPT_FINAL", "Accept note")}
              <Button className="w-full" onClick={() => runWorkflowAction(request, "Client accepted final delivery", "Client Acceptance", () => clientAcceptFinal(request.id, getActionNote("CLIENT_ACCEPT_FINAL")))}>
                <CheckCircle2 className="h-4 w-4" /> Accept
              </Button>
            </>)}

          {canClientRejectFinal &&
            actionCard("Reject Final Delivery", "Reject the final delivery and archive the item for the client.", <>
              {renderNote("CLIENT_REJECT_FINAL", "Reject reason")}
              <Button variant="destructive" className="w-full" onClick={() => runWorkflowAction(request, "Client rejected final delivery", "Client Acceptance", () => clientRejectFinal(request.id, getActionNote("CLIENT_REJECT_FINAL")))}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>, true)}

          {canClientRequestRevision &&
            actionCard("Request Client Revision", "Request revision for the final delivery and send it back to CCR / Marketing.", <>
              {renderNote("CLIENT_REQUEST_REVISION", "Revision instruction")}
              <Button variant="outline" className="w-full" onClick={() => { const uploadKeys = getActionUploadFileKeys(); runWorkflowAction(request, "Client requested revision", "Client Acceptance", () => clientRequestRevision(request.id, getActionNote("CLIENT_REQUEST_REVISION"), uploadKeys)); }}>
                <Send className="h-4 w-4" /> Request Revision
              </Button>
            </>, true)}

          {canMarketingSubmitClientRevision &&
            actionCard("Send Revision Response to Client", "CCR / Marketing can solve the client revision directly, attach the corrected file(s), and send it back to the Client.", <>
              {renderNote("MARKETING_SUBMIT_CLIENT_REVISION", "Client revision response note")}
              <Button className="w-full" onClick={() => { const uploadKeys = getActionUploadFileKeys(); runWorkflowAction(request, "Revision response sent to Client", "Marketing Final Delivery", () => marketingSubmitClientRevision(request.id, getActionNote("MARKETING_SUBMIT_CLIENT_REVISION"), selectedPackageFileIds, uploadKeys)); }}><Send className="h-4 w-4" /> Send to Client</Button>
            </>)}

          {canMarketingRouteClientRevisionTms &&
            actionCard("Route Client Revision to TMS Manager", "Use this when CCR / Marketing cannot solve the client revision directly. TMS Manager can then assign TMS members or request PM revision.", <>
              {renderNote("MARKETING_ROUTE_CLIENT_REVISION_TMS", "Revision routing note for TMS Manager")}
              <Button className="w-full" onClick={() => runWorkflowAction(request, "Client revision routed to TMS Manager", "Marketing / Client Clarification", () => marketingRouteClientRevisionToTms(request.id, getActionNote("MARKETING_ROUTE_CLIENT_REVISION_TMS")))}><Send className="h-4 w-4" /> Send to TMS Manager</Button>
            </>)}

          {canMarketingRouteClientRevisionPm &&
            actionCard("Route Client Revision to PM Lead", "CCR / Marketing reviews the client revision and restarts the necessary part of the PM cycle.", <>
              {renderNote("MARKETING_ROUTE_CLIENT_REVISION_PM", "Revision routing note")}
              <Button className="w-full" onClick={() => runWorkflowAction(request, "Client revision routed to PM lead", "Marketing / Client Clarification", () => marketingSendClientRevisionToPm(request.id, getActionNote("MARKETING_ROUTE_CLIENT_REVISION_PM")))}><Send className="h-4 w-4" /> Send to PM Lead</Button>
            </>)}

          {canOriginMember &&
            actionCard("Legacy Division Member Review", "Legacy fallback action retained for older demo records.", <>
              {renderNote("DIVISION_MEMBER_REVIEW", "Review note")}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => runWorkflowAction(request, "Division member approved", "Division Final Review", () => originMemberDecision(request.id, true, getActionNote("DIVISION_MEMBER_REVIEW")))}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                <Button variant="destructive" className="flex-1" onClick={() => runWorkflowAction(request, "Returned back to TMS", "Division Final Review", () => originMemberDecision(request.id, false, getActionNote("DIVISION_MEMBER_REVIEW")))}><XCircle className="h-4 w-4" />Reject</Button>
              </div>
            </>)}

          {canOriginManager &&
            actionCard("Legacy Division Manager Approval", "Legacy fallback action retained for older demo records.", <>
              {renderNote("DIVISION_MANAGER_APPROVE", "Manager note")}
              <Button className="w-full" onClick={() => runWorkflowAction(request, "Division manager approved", "Division Final Review", () => originManagerApprove(request.id, getActionNote("DIVISION_MANAGER_APPROVE")))}><CheckCircle2 className="h-4 w-4" /> Approve as Manager</Button>
            </>)}

          {canForwardToCcr &&
            actionCard("Legacy Forward to CCR", "Legacy fallback action retained for older demo records.", <>
              {renderNote("FORWARD_TO_CCR", "Forwarding note")}
              <Button className="w-full" onClick={() => runWorkflowAction(request, "Forwarded to CCR", "CCR Closeout", () => forwardToCcr(request.id, getActionNote("FORWARD_TO_CCR")))}><Send className="h-4 w-4" /> Forward to CCR</Button>
            </>)}

          {canList &&
            actionCard("Legacy Merge / Final HML Listing", "Legacy final listing action retained for older demo records.", <Button className="w-full" onClick={() => openFinalListingFromAction(request)}><GitMerge className="h-4 w-4" /> Merge Final Document</Button>)}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Work Requests"
        description="Track and manage work requests across divisions"
        actions={
          canCreate ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Work Request
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search work requests..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-4">
        {groupedVisibleRequests.map((group) => {
          const isFolderExpanded = isParentFolderExpanded(group.parentId);
          const requestCount = group.requests.length;
          const activeCount = group.requests.filter((request) => !["HML_LISTED", "REJECTED"].includes(request.currentStatus)).length;

          return (
            <div key={group.parentId} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                type="button"
                onClick={() => toggleParentFolder(group.parentId)}
                className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/25 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Folder className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{group.parent?.code || "No parent"}</span>
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {group.parent?.type || "Project"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {requestCount} work request{requestCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-muted-foreground">{activeCount} active</span>
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-card-foreground">
                      {group.parent ? getProjectLabel(group.parent) : "No parent project"}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{isFolderExpanded ? "Hide requests" : "Open folder"}</span>
                  {isFolderExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isFolderExpanded ? (
                <div className="space-y-3 border-t border-border bg-muted/10 p-4">
                  {group.requests.map((request) => {
                    const division = getDivision(request.assignedDivisionId);
                    const parent = getProject(request.parentId);
                    const isExpanded = expandedId === request.id;
                    const currentHandler = getCurrentHandler(request);

                    return (
                      <div id={`work-request-${request.id}`} key={request.id} className="overflow-hidden rounded-xl border border-border bg-background scroll-mt-6">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : request.id)}
                          className="flex w-full flex-col gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/25 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{request.code}</span>
                              <StatusBadge status={statusToSimple(request.currentStatus)} />
                              <span className="text-xs font-medium text-muted-foreground">{requestStageLabel(request.currentStatus)}</span>
                              <span className={`text-xs font-semibold ${priorityClass(request.priority)}`}>{request.priority}</span>
                              <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {request.category}
                              </span>
                              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                {request.parentType === "BID" ? "Bid" : "Project"}
                              </span>
                            </div>
                            <h3 className="mt-2 text-sm font-semibold text-card-foreground">{request.title}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Project: <span className="font-medium text-card-foreground">{parent ? getProjectLabel(parent) : "No parent project"}</span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground lg:justify-end">
                            <span>{parent?.code || "No parent"}</span>
                            <span>{division?.abbr || "—"}</span>
                            <span>{currentHandler}</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-border px-5 py-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workflow Progress</p>

                            <div className="pb-2">
                              <WorkflowTimeline steps={getWorkflowSteps(request, division?.abbr || "ECM")} />
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => setDetailRequestId(request.id)}>
                                <Eye className="h-4 w-4" /> Details
                              </Button>

                              <Button variant="outline" size="sm" onClick={() => { setHistoryMode("TRANSFER"); setHistoryRequestId(request.id); }}>
                                <History className="h-4 w-4" /> History ({request.revisionHistory.length})
                              </Button>

                              {hasWorkflowAction(request) ? (
                                <Button size="sm" onClick={() => openActionModal(request)}>
                                  <Send className="h-4 w-4" /> Workflow Action
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        {!visibleRequests.length && (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No visible work requests for the current actor.
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Work Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Parent Type</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    checked={createForm.parentType === "BID"}
                    onChange={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        parentType: "BID",
                        parentId: state.projects.find((project) => project.type === "BID" && project.status !== "ARCHIVED")?.id || "",
                      }))
                    }
                  />
                  Bid
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    checked={createForm.parentType === "PROJECT"}
                    onChange={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        parentType: "PROJECT",
                        parentId: state.projects.find((project) => project.type === "PROJECT" && project.status === "ACTIVE")?.id || "",
                      }))
                    }
                  />
                  Project
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Select {createForm.parentType}</label>
                <select
                  value={createForm.parentId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Choose</option>
                  {availableParents.length ? (
                    availableParents.map((project) => (
                      <option key={project.id} value={project.id}>
                        {getProjectLabel(project)}
                      </option>
                    ))
                  ) : (
                    <option value="">No eligible parent available</option>
                  )}
                </select>

                {selectedParent ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selected parent: <span className="font-medium text-card-foreground">{getProjectLabel(selectedParent)}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {createForm.parentType === "BID"
                      ? "Create a new Bid first, then create one or more work requests under it."
                      : "Create or convert an active Project first, then create one or more work requests under it."}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Assigned Division</label>
                <select
                  value={createForm.assignedDivisionId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, assignedDivisionId: event.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {state.divisions
                    .filter((division) => ["div-ecm", "div-pmo"].includes(division.id))
                    .map((division) => (
                      <option key={division.id} value={division.id}>
                        {division.abbr} — {division.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
                <input
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Type work/doc request title"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Category</label>
                <select
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {workRequestTypes.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Attachment Category</label>
                <select
                  value={createForm.attachmentCategory}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, attachmentCategory: event.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {projectInfoCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Priority</label>
                <select
                  value={createForm.priority}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value as "High" | "Medium" | "Low" }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Work Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRequest} onOpenChange={() => setDetailRequestId(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Work Request Details</DialogTitle>
          </DialogHeader>

          {detailRequest
            ? (() => {
                const parent = getProject(detailRequest.parentId);
                const division = getDivision(detailRequest.assignedDivisionId);
                const primaryFiles = parent?.initialDocuments.filter((doc) => getAttachmentFileGroup(doc) === "PRIMARY") || [];
                const workflowFiles = getRequestWorkflowFiles(detailRequest);
                const allFiles = [...primaryFiles, ...workflowFiles];
                const fileTypeOptions = Array.from(new Set(allFiles.map((doc) => getFileTypeKey(doc)))).sort((a, b) => a.localeCompare(b));
                const filteredPrimaryFiles = filterAttachmentFiles(primaryFiles, detailFileSearch, detailFileType, detailFileDate);
                const filteredWorkflowFiles = filterAttachmentFiles(workflowFiles, detailFileSearch, detailFileType, detailFileDate);
                const filteredPrimaryGroups = getDocumentRevisionGroups(filteredPrimaryFiles);
                const filteredWorkflowGroups = getDocumentRevisionGroups(filteredWorkflowFiles);
                const hasActiveFileFilter = Boolean(detailFileSearch.trim() || detailFileType !== "ALL" || detailFileDate);

                return (
                  <div className="space-y-5 py-2">
                    <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Request</p>
                        <p className="font-medium text-foreground">{detailRequest.code}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Parent</p>
                        <p className="font-medium text-foreground">{parent?.code || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Division</p>
                        <p className="font-medium text-foreground">{division?.abbr || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Current Handler</p>
                        <p className="font-medium text-foreground">{getCurrentHandler(detailRequest)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-muted-foreground">Title</p>
                        <p className="font-medium text-foreground">{detailRequest.title}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="font-medium text-foreground">{getWorkRequestStatusLabel(detailRequest.currentStatus)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Priority</p>
                        <p className={`font-medium ${priorityClass(detailRequest.priority)}`}>{detailRequest.priority}</p>
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="font-medium text-foreground">{detailRequest.notes || "—"}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="mb-3 flex flex-col gap-1">
                        <h4 className="text-sm font-semibold text-card-foreground">File Filters</h4>
                        <p className="text-xs text-muted-foreground">
                          Search by file name, filter by uploaded file type, or filter by a specific upload date.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto] md:items-end">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search File Name</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                              value={detailFileSearch}
                              onChange={(event) => setDetailFileSearch(event.target.value)}
                              placeholder="Search by file name..."
                              className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">File Type</label>
                          <select
                            value={detailFileType}
                            onChange={(event) => setDetailFileType(event.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="ALL">All Types</option>
                            {fileTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {getFileTypeLabel(type)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload Date</label>
                          <input
                            type="date"
                            value={detailFileDate}
                            onChange={(event) => setDetailFileDate(event.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>

                        <Button
                          variant="outline"
                          disabled={!hasActiveFileFilter}
                          onClick={() => {
                            setDetailFileSearch("");
                            setDetailFileType("ALL");
                            setDetailFileDate("");
                          }}
                        >
                          Clear
                        </Button>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground">
                        Showing {filteredPrimaryFiles.length + filteredWorkflowFiles.length} of {allFiles.length} file(s)
                      </p>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-card-foreground">Primary File List</h4>
                      <p className="mt-1 text-xs text-muted-foreground">Original client documents uploaded by CCR / Marketing.</p>

                      <div className="mt-3 space-y-3">
                        {filteredPrimaryGroups.length ? (
                          filteredPrimaryGroups.map((group) => renderRevisionGroupCard(group))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                            {hasActiveFileFilter ? "No primary client document matches this filter." : "No primary client document uploaded yet."}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-card-foreground">Workflow / Collaboration Files</h4>
                      <p className="mt-1 text-xs text-muted-foreground">Files uploaded later by client, ECM/PMO, TMS, CCR, or other authorized users.</p>

                      <div className="mt-3 space-y-3">
                        {filteredWorkflowGroups.length ? (
                          filteredWorkflowGroups.map((group) => renderRevisionGroupCard(group))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                            {hasActiveFileFilter ? "No workflow collaboration file matches this filter." : "No workflow collaboration file uploaded yet."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>File Preview</DialogTitle>
          </DialogHeader>

          {previewFile ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium text-foreground">{previewFile.name}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-medium text-foreground">v{previewFile.version || 1}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">File Type</p>
                  <p className="font-medium text-foreground">{getFileTypeLabel(getFileTypeKey(previewFile))}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{previewFile.category}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Uploaded By</p>
                  <p className="font-medium text-foreground">{previewFile.uploadedBy}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Uploaded At</p>
                  <p className="font-medium text-foreground">{formatDate(previewFile.uploadedAt)}</p>
                </div>
              </div>

              {previewFile.fileDataUrl && isImageFile(previewFile) ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <img src={previewFile.fileDataUrl} alt={previewFile.name} className="max-h-[60vh] w-full rounded-lg object-contain" />
                </div>
              ) : null}

              {previewFile.fileDataUrl && isPdfFile(previewFile) ? (
                <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  <iframe src={previewFile.fileDataUrl} title={previewFile.name} className="h-[65vh] w-full" />
                </div>
              ) : null}

              {previewFile.textContent ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text Content</p>
                  <pre className="whitespace-pre-wrap text-sm text-card-foreground">{previewFile.textContent}</pre>
                </div>
              ) : null}

              {previewFile.fileDataUrl && !isImageFile(previewFile) && !isPdfFile(previewFile) && !previewFile.textContent ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Preview is not available for this file type. Please download the file to view it.
                </div>
              ) : null}

              {!previewFile.fileDataUrl && !previewFile.textContent ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Preview is not available for this older/demo metadata file. You can still download its metadata.
                </div>
              ) : null}

              {previewFile.note ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <span className="font-medium text-card-foreground">Note:</span> {previewFile.note}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button onClick={() => void downloadAttachment(previewFile)}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!actionRequest}
        onOpenChange={(open) => {
          if (!open) {
            setActionRequestId(null);
            setActionFiles([]);
            setSelectedPackageFileIds([]);
            setInfoTargetChoice("");
            setActionDisplayChoice("");
            setActionDoc(createEmptyDocumentRow(state.settings.categories[0] || "General"));
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Action</DialogTitle>
          </DialogHeader>

          {actionRequest ? (
            <div className="space-y-5 py-2">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Request</p>
                  <p className="font-medium text-foreground">{actionRequest.code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium text-foreground">{actionRequest.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">{getWorkRequestStatusLabel(actionRequest.currentStatus)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Handler</p>
                  <p className="font-medium text-foreground">{getCurrentHandler(actionRequest)}</p>
                </div>
              </div>

              {renderActionFeedbackMessages(actionRequest)}

              {renderActionPackageSection(actionRequest)}

              {renderOptionalActionUploadFields()}

              {renderActionPanel(actionRequest)}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadRequest} onOpenChange={() => setUploadRequestId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Workflow / Collaboration File</DialogTitle>
          </DialogHeader>

          {uploadRequest ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Request</p>
                    <p className="font-medium text-foreground">{uploadRequest.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium text-foreground">{uploadRequest.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Stage</p>
                    <p className="font-medium text-foreground">{getWorkRequestStatusLabel(uploadRequest.currentStatus)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-card-foreground">Upload Updated File / Note</h4>
                  <p className="text-xs text-muted-foreground">
                    Category and workflow stage are taken from this work request and its current stage.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload File(s)</label>
                    <input
                      type="file"
                      multiple
                      onChange={(event) => void handleUploadFileChange(event.target.files)}
                      className="w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">You can select multiple files at once.</p>
                  </div>

                  <div className="md:col-span-2">
                    {renderSelectedFiles(uploadFiles, (index) => setUploadFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index)))}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Note / Message</label>
                    <input
                      value={uploadDoc.note || ""}
                      onChange={(event) => setUploadDoc((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="Optional workflow message. Saved in history, and with uploaded file(s) when attached."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadRequestId(null)}>
              Cancel
            </Button>
            <Button onClick={() => uploadRequest && uploadUpdatedDocument(uploadRequest)}>
              <Upload className="h-4 w-4" /> Upload File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyRequest} onOpenChange={() => setHistoryRequestId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History</DialogTitle>
          </DialogHeader>

          {historyRequest
            ? (() => {
                const relatedFiles = getRequestWorkflowFiles(historyRequest);
                const revisionGroups = getDocumentRevisionGroups(relatedFiles);

                return (
                  <div className="space-y-4 py-2">
                    <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/20 p-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-card-foreground">
                        <input
                          type="radio"
                          checked={historyMode === "TRANSFER"}
                          onChange={() => setHistoryMode("TRANSFER")}
                        />
                        Transfer History
                      </label>

                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-card-foreground">
                        <input
                          type="radio"
                          checked={historyMode === "REVISION"}
                          onChange={() => setHistoryMode("REVISION")}
                        />
                        Revision History
                      </label>
                    </div>

                    {historyMode === "TRANSFER" ? (
                      <div className="space-y-0">
                        {[...historyRequest.revisionHistory].map((entry, index, list) => (
                          <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                            <div className="relative flex w-4 justify-center">
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                              {index < list.length - 1 ? <span className="absolute left-1/2 top-5 h-[calc(100%-0.5rem)] w-px -translate-x-1/2 bg-border" /> : null}
                            </div>
                            <div>
                              <h4 className="font-semibold text-card-foreground">{entry.action}</h4>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {entry.by}
                                {entry.to ? (
                                  <>
                                    {" "}
                                    <ArrowRight className="mx-1 inline h-3 w-3" /> {entry.to}
                                  </>
                                ) : null}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(entry.at)}</p>
                              {entry.note ? (
                                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">Important Note</p>
                                  <p className="mt-1 whitespace-pre-wrap">{entry.note}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border bg-muted/20 p-4">
                          <h4 className="text-sm font-semibold text-card-foreground">Document Revision History</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Files are grouped by file name. Re-uploading the same file name creates the next version.
                          </p>
                        </div>

                        {revisionGroups.length ? (
                          revisionGroups.map((group) => (
                            <div key={group.key} className="rounded-xl border border-border bg-card p-4">
                              <div className="mb-3 flex flex-wrap items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-card-foreground">{group.name}</h4>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {group.revisions.length} revision{group.revisions.length === 1 ? "" : "s"}
                                </span>
                              </div>

                              <div className="space-y-3">
                                {group.revisions.map((doc, index) => (
                                  <div key={doc.id} className="relative flex gap-3 rounded-lg border border-border bg-muted/20 p-3">
                                    <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                      v{doc.version || index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-card-foreground">{doc.name}</p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {doc.category} · {doc.workflowStage || "Workflow Collaboration"} · Uploaded by {doc.uploadedBy} · {formatDate(doc.uploadedAt)}
                                      </p>
                                      {doc.fileName ? (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          File: {doc.fileName} · {getFileTypeLabel(getFileTypeKey(doc))} · {formatFileSize(doc.fileSize)}
                                        </p>
                                      ) : null}
                                      {doc.note ? (
                                        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
                                          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500 dark:text-rose-300">Revision / File Message</p>
                                          <p className="mt-1 whitespace-pre-wrap">{doc.note}</p>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                      <Button variant="outline" size="sm" onClick={() => setPreviewFile(doc)}>
                                        <Eye className="h-4 w-4" /> View
                                      </Button>
                                      <Button variant="outline" size="sm" onClick={() => void downloadAttachment(doc)}>
                                        <Download className="h-4 w-4" /> Download
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                            No workflow document revision has been uploaded yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showListDialog} onOpenChange={() => setShowListDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final HML Document Listing</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <input
              value={listDocForm.name}
              onChange={(event) => setListDocForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Final document name"
            />

            <select
              value={listDocForm.category}
              onChange={(event) => setListDocForm((prev) => ({ ...prev, category: event.target.value }))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {state.settings.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (showListDialog && listDocForm.name.trim()) {
                  listFinalDocument(showListDialog, listDocForm);
                  toast.success("Final document merged/listed in HML registry");
                  setShowListDialog(null);
                }
              }}
            >
              Merge / List Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
