import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ChevronLeft,
  Download,
  Eye,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Paperclip,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatDate,
  getProjectLabel,
  getWorkRequestStatusLabel,
  type AttachmentInput,
  type AttachmentRef,
  type ProjectItem,
  type WorkRequest,
  usePortal,
} from "@/lib/portal-data";

type DocumentsSearch = {
  projectId?: string;
};

export const Route = createFileRoute("/documents")({
  validateSearch: (search: Record<string, unknown>): DocumentsSearch => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: DocumentsPage,
  head: () => ({
    meta: [{ title: "Documents — Project Portal" }],
  }),
});

type FileGroup = "PRIMARY" | "WORKFLOW";
type UploadDocumentDraft = AttachmentInput;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "document";
}

function formatFileSize(size?: number) {
  if (!size) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentFileGroup(doc: AttachmentRef): FileGroup {
  const fileGroup = (doc as AttachmentRef & { fileGroup?: FileGroup }).fileGroup;
  return fileGroup || "PRIMARY";
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

function projectRecordLabel(project: ProjectItem) {
  if (project.status === "ARCHIVED") return "Archive";
  return project.type === "BID" ? "Bid" : "Project";
}

function projectRecordClass(project: ProjectItem) {
  if (project.status === "ARCHIVED") return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300";
  if (project.type === "BID") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
}

function getAttachmentStableKey(doc: AttachmentRef) {
  return (doc.versionKey || doc.fileName || doc.name || doc.id).trim().toLowerCase();
}

function getDocumentRevisionGroups(files: AttachmentRef[]) {
  const groups = new Map<string, AttachmentRef[]>();

  files.forEach((file) => {
    const key = getAttachmentStableKey(file) || file.id;
    const existing = groups.get(key) || [];
    existing.push(file);
    groups.set(key, existing);
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

function isStoredFileAttachment(file: AttachmentRef) {
  return Boolean(file.fileName || file.fileDataUrl || file.textContent);
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

function getFileTypeIcon(doc: AttachmentRef) {
  const ext = getFileTypeKey(doc);

  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return FileImage;
  if (["xls", "xlsx", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
  return FileText;
}

function sortLatestFirst(a: AttachmentRef, b: AttachmentRef) {
  return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
}

function requestPriorityClass(priority: WorkRequest["priority"]) {
  if (priority === "High") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (priority === "Medium") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
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
        doc.note || "Original binary file is not available for this older/demo document because only metadata was stored.",
      ].join("\n");

  const blob = new Blob([fallbackText], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = safeFileName(doc.fileName || `${doc.name}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function DocumentsPage() {
  const routeSearch = Route.useSearch();
  const { state, currentActor, addWorkRequestDocument } = usePortal();

  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(routeSearch.projectId || null);
  const [selectedWorkRequestId, setSelectedWorkRequestId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AttachmentRef | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null);
  const [uploadWorkRequestId, setUploadWorkRequestId] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState("");
  const [uploadFiles, setUploadFiles] = useState<UploadDocumentDraft[]>([]);
  const [detailFileSearch, setDetailFileSearch] = useState("");
  const [detailFileType, setDetailFileType] = useState("ALL");
  const [detailFileGroup, setDetailFileGroup] = useState<"ALL" | FileGroup>("ALL");

  useEffect(() => {
    if (routeSearch.projectId) {
      setSelectedProjectId(routeSearch.projectId);
      setSelectedWorkRequestId(null);
    }
  }, [routeSearch.projectId]);

  useEffect(() => {
    if (!selectedWorkRequestId) {
      setDetailFileSearch("");
      setDetailFileType("ALL");
      setDetailFileGroup("ALL");
    }
  }, [selectedWorkRequestId]);

  const selectedProject = selectedProjectId ? state.projects.find((project) => project.id === selectedProjectId) : undefined;
  const selectedWorkRequest = selectedWorkRequestId ? state.workRequests.find((request) => request.id === selectedWorkRequestId) : undefined;
  const uploadProject = uploadProjectId ? state.projects.find((project) => project.id === uploadProjectId) : undefined;
  const uploadWorkRequest = uploadWorkRequestId ? state.workRequests.find((request) => request.id === uploadWorkRequestId) : undefined;
  const uploadMeta = {
    category: uploadWorkRequest?.attachmentCategory || uploadWorkRequest?.category || "General",
    workflowStage: "Workflow Collaboration",
  };

  const canUploadDocuments = (project: ProjectItem) => currentActor.role !== "client_owner" || currentActor.clientId === project.clientId;

  const projectFolders = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();

    return state.projects
      .filter((project) => {
        const text = `${project.code} ${project.name} ${project.type} ${project.status}`.toLowerCase();
        return !q || text.includes(q);
      })
      .map((project) => {
        const files = project.initialDocuments || [];
        const workRequests = state.workRequests.filter((request) => request.parentId === project.id);
        const latestFile = [...files].sort(sortLatestFirst)[0];

        return {
          project,
          files,
          workRequests,
          latestFile,
          primaryCount: files.filter((doc) => getAttachmentFileGroup(doc) === "PRIMARY").length,
          workflowCount: files.filter((doc) => getAttachmentFileGroup(doc) === "WORKFLOW").length,
        };
      })
      .sort((a, b) => {
        const aTime = a.latestFile?.uploadedAt || a.project.createdAt;
        const bTime = b.latestFile?.uploadedAt || b.project.createdAt;
        return bTime.localeCompare(aTime);
      });
  }, [projectSearch, state.projects, state.workRequests]);

  const selectedProjectWorkRequests = useMemo(() => {
    if (!selectedProject) return [];
    return state.workRequests
      .filter((request) => request.parentId === selectedProject.id)
      .sort((a, b) => b.lastTransferredAt.localeCompare(a.lastTransferredAt));
  }, [selectedProject, state.workRequests]);

  const getWorkRequestFiles = (request: WorkRequest) => {
    const project = state.projects.find((item) => item.id === request.parentId);
    if (!project) return [];

    const relatedRequests = state.workRequests.filter((item) => item.parentId === request.parentId);
    const workflowFiles = project.initialDocuments
      .filter((file) => getAttachmentFileGroup(file) === "WORKFLOW")
      .filter((file) => file.workRequestId === request.id || (!file.workRequestId && relatedRequests.length <= 1))
      .filter(isStoredFileAttachment);

    const workflowKeys = new Set(workflowFiles.map((file) => getAttachmentStableKey(file)).filter(Boolean));
    const matchingPrimaryVersions = project.initialDocuments
      .filter((file) => getAttachmentFileGroup(file) === "PRIMARY")
      .filter((file) => workflowKeys.has(getAttachmentStableKey(file)))
      .filter(isStoredFileAttachment);

    return [...matchingPrimaryVersions, ...workflowFiles].sort((a, b) => {
      const keyDiff = getAttachmentStableKey(a).localeCompare(getAttachmentStableKey(b));
      if (keyDiff !== 0) return keyDiff;
      const versionDiff = (a.version || 1) - (b.version || 1);
      if (versionDiff !== 0) return versionDiff;
      return a.uploadedAt.localeCompare(b.uploadedAt);
    });
  };

  const selectedWorkRequestFiles = selectedWorkRequest ? getWorkRequestFiles(selectedWorkRequest) : [];
  const selectedWorkRequestFileTypes = [...new Set(selectedWorkRequestFiles.map((file) => getFileTypeKey(file)))].filter(Boolean).sort();
  const filteredSelectedWorkRequestFiles = selectedWorkRequestFiles.filter((file) => {
    const q = detailFileSearch.trim().toLowerCase();
    const fileType = getFileTypeKey(file);
    const fileGroup = getAttachmentFileGroup(file);
    const searchableText = [
      file.name,
      file.fileName,
      file.category,
      file.workflowStage,
      file.uploadedBy,
      file.note,
      fileType,
      `v${file.version || 1}`,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !q || searchableText.includes(q);
    const matchesType = detailFileType === "ALL" || fileType === detailFileType;
    const matchesGroup = detailFileGroup === "ALL" || fileGroup === detailFileGroup;

    return matchesSearch && matchesType && matchesGroup;
  });
  const selectedWorkRequestGroups = getDocumentRevisionGroups(filteredSelectedWorkRequestFiles);

  const openProjectFolder = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedWorkRequestId(null);
  };

  const closeProjectFolder = () => {
    setSelectedProjectId(null);
    setSelectedWorkRequestId(null);
  };

  const resetUploadForm = () => {
    setUploadProjectId(null);
    setUploadWorkRequestId(null);
    setUploadNote("");
    setUploadFiles([]);
  };

  const openUploadDialog = (projectId: string, workRequestId: string) => {
    setUploadProjectId(projectId);
    setUploadWorkRequestId(workRequestId);
    setUploadNote("");
    setUploadFiles([]);
  };

  const handleUploadFileChange = async (files?: FileList | null) => {
    if (!files?.length) return;

    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          category: uploadMeta.category,
          workflowStage: uploadMeta.workflowStage,
          note: uploadNote.trim() || undefined,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          fileDataUrl: await readFileAsDataUrl(file),
        }))
      );

      setUploadFiles(uploaded);
    } catch {
      toast.error("Could not read selected file(s)");
    }
  };

  const submitUploadFiles = () => {
    if (!uploadWorkRequestId) return toast.error("Select a work request before uploading");
    if (!uploadFiles.length) return toast.error("Select at least one file before uploading");

    uploadFiles.forEach((file) => {
      addWorkRequestDocument(uploadWorkRequestId, {
        ...file,
        category: uploadMeta.category,
        workflowStage: uploadMeta.workflowStage,
        note: uploadNote.trim() || file.note,
      });
    });

    toast.success(uploadFiles.length === 1 ? "File uploaded" : "Files uploaded", {
      description: `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} added to ${uploadWorkRequest?.code || "this work request"}.`,
    });
    resetUploadForm();
  };

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
        {group.revisions.map((doc, index) => {
          const FileIcon = getFileTypeIcon(doc);

          return (
            <div key={doc.id} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary">
                      v{doc.version || index + 1}
                    </span>
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
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

                  {doc.fileName ? <p className="mt-1 text-xs text-muted-foreground">File: {doc.fileName} · {formatFileSize(doc.fileSize)}</p> : null}
                  {doc.note ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">Note: {doc.note}</p> : null}
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
        })}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Documents" />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search project folders..."
            value={projectSearch}
            onChange={(event) => setProjectSearch(event.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {selectedProject ? (
          <Button variant="outline" onClick={closeProjectFolder}>
            <ChevronLeft className="h-4 w-4" /> Back to Folders
          </Button>
        ) : null}
      </div>

      {!selectedProject ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectFolders.map(({ project, files, workRequests, latestFile, primaryCount, workflowCount }) => (
            <div key={project.id} className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Folder className="h-7 w-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-card-foreground">{project.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${projectRecordClass(project)}`}>{projectRecordLabel(project)}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{project.code}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-border bg-muted/30 px-2 py-3 text-center">
                  <p className="text-lg font-semibold text-card-foreground">{workRequests.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Requests</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-2 py-3 text-center">
                  <p className="text-lg font-semibold text-card-foreground">{files.length}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Files</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-2 py-3 text-center">
                  <p className="text-lg font-semibold text-card-foreground">{primaryCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Primary</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 px-2 py-3 text-center">
                  <p className="text-lg font-semibold text-card-foreground">{workflowCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Workflow</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-3">
                <p className="text-xs font-medium text-card-foreground">Latest Activity</p>
                <p className="mt-1 text-xs text-muted-foreground">{latestFile ? `${latestFile.name} · ${formatDate(latestFile.uploadedAt)}` : "No file uploaded yet"}</p>
              </div>

              <div className="mt-5">
                <Button className="w-full" onClick={() => openProjectFolder(project.id)}>
                  <FolderOpen className="h-4 w-4" /> Open
                </Button>
              </div>
            </div>
          ))}

          {!projectFolders.length ? (
            <div className="col-span-full rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">No project folders found.</div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-card-foreground">{selectedProject.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${projectRecordClass(selectedProject)}`}>{projectRecordLabel(selectedProject)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{getProjectLabel(selectedProject)}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-base font-semibold text-card-foreground">{selectedProjectWorkRequests.length}</p>
                  <p className="text-muted-foreground">Requests</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-base font-semibold text-card-foreground">{selectedProject.initialDocuments.length}</p>
                  <p className="text-muted-foreground">Files</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-base font-semibold text-card-foreground">{state.documents.filter((doc) => doc.projectId === selectedProject.id).length}</p>
                  <p className="text-muted-foreground">HML</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedProjectWorkRequests.map((request) => {
              const requestFiles = getWorkRequestFiles(request);

              return (
                <div key={request.id} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/20">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{request.category}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${requestPriorityClass(request.priority)}`}>{request.priority}</span>
                  </div>

                  <h4 className="line-clamp-2 font-semibold text-card-foreground">{request.title}</h4>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{request.code}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Status: {getWorkRequestStatusLabel(request.currentStatus)}</p>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <span>{requestFiles.length} File{requestFiles.length === 1 ? "" : "s"}</span>
                    <span>{formatDate(request.lastTransferredAt)}</span>
                  </div>

                  <Button className="mt-4 w-full" variant="outline" onClick={() => setSelectedWorkRequestId(request.id)}>
                    <Eye className="h-4 w-4" /> Details
                  </Button>
                </div>
              );
            })}

            {!selectedProjectWorkRequests.length ? (
              <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No work request found under this project.
              </div>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={!!selectedWorkRequest} onOpenChange={() => setSelectedWorkRequestId(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <DialogTitle>{selectedWorkRequest ? `${selectedWorkRequest.code} — Files` : "Work Request Files"}</DialogTitle>
                {selectedWorkRequest ? <p className="mt-1 text-sm text-muted-foreground">{selectedWorkRequest.title}</p> : null}
              </div>

              {selectedProject && selectedWorkRequest && canUploadDocuments(selectedProject) ? (
                <Button variant="outline" onClick={() => openUploadDialog(selectedProject.id, selectedWorkRequest.id)}>
                  <Upload className="h-4 w-4" /> Upload New File
                </Button>
              ) : null}
            </div>
          </DialogHeader>

          {selectedWorkRequest ? (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium text-foreground">{selectedWorkRequest.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground">{getWorkRequestStatusLabel(selectedWorkRequest.currentStatus)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <p className="font-medium text-foreground">{selectedWorkRequest.priority}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">File Groups</p>
                  <p className="font-medium text-foreground">{selectedWorkRequestGroups.length}</p>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_180px_180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={detailFileSearch}
                    onChange={(event) => setDetailFileSearch(event.target.value)}
                    placeholder="Search files, uploader, note, version..."
                    className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <select
                  value={detailFileType}
                  onChange={(event) => setDetailFileType(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">All File Types</option>
                  {selectedWorkRequestFileTypes.map((type) => (
                    <option key={type} value={type}>
                      {getFileTypeLabel(type)}
                    </option>
                  ))}
                </select>

                <select
                  value={detailFileGroup}
                  onChange={(event) => setDetailFileGroup(event.target.value as "ALL" | FileGroup)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">All Groups</option>
                  <option value="PRIMARY">Primary</option>
                  <option value="WORKFLOW">Workflow</option>
                </select>
              </div>

              {selectedWorkRequestGroups.length ? (
                <div className="space-y-4">{selectedWorkRequestGroups.map((group) => renderRevisionGroupCard(group))}</div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                  {selectedWorkRequestFiles.length ? "No files match your search or filter." : "No file uploaded for this work request yet."}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadProject && !!uploadWorkRequest} onOpenChange={(open) => !open && resetUploadForm()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload File{uploadWorkRequest ? ` — ${uploadWorkRequest.code}` : uploadProject ? ` — ${uploadProject.code}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload File</label>
              <input
                type="file"
                multiple
                onChange={(event) => void handleUploadFileChange(event.target.files)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
              />
            </div>

            {uploadFiles.length ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                {uploadFiles.map((file) => (
                  <p key={`${file.fileName}-${file.fileSize}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="truncate">{file.fileName}</span>
                    <span>· {formatFileSize(file.fileSize)}</span>
                  </p>
                ))}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Note</label>
              <input
                type="text"
                value={uploadNote}
                onChange={(event) => setUploadNote(event.target.value)}
                placeholder="Optional note"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetUploadForm}>Cancel</Button>
            <Button onClick={submitUploadFiles}>Upload</Button>
          </DialogFooter>
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
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
