import React, { useState, useMemo } from "react";
import {
  X,
  Folder,
  FolderOpen,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface FileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  file?: File;
  children?: TreeNode[];
}

/**
 * Build a tree structure from a flat list of files using webkitRelativePath
 */
function buildFileTree(files: File[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map: Record<string, TreeNode> = {};

  files.forEach((file) => {
    // If webkitRelativePath is empty/missing, treat as a root file
    const pathParts = (file.webkitRelativePath || file.name).split("/");

    // For single file selection (no directory), webkitRelativePath might be empty or just the filename
    // We want to handle standard upload vs folder upload

    let currentLevel = root;
    let currentPath = "";

    pathParts.forEach((part, index) => {
      const isFile = index === pathParts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let node = currentLevel.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        currentLevel.push(node);
      }

      if (!isFile && node.children) {
        currentLevel = node.children;
      }
    });
  });

  // Sort: Folders first, then files, alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "folder" ? -1 : 1;
    });
    nodes.forEach((node) => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root);
  return root;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode size={16} className="text-blue-500" />;
    case "json":
      return <FileJson size={16} className="text-yellow-500" />;
    case "md":
    case "txt":
      return <FileText size={16} className="text-gray-500" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
      return <FileImage size={16} className="text-purple-500" />;
    case "css":
    case "scss":
    case "less":
      return <FileCode size={16} className="text-blue-400" />;
    case "html":
      return <FileCode size={16} className="text-orange-500" />;
    default:
      return <FileIcon size={16} className="text-gray-400" />;
  }
}

const FileTreeItem = ({ node, depth = 0 }: { node: TreeNode; depth?: number }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (node.type === "file") {
    return (
      <div
        className="flex items-center py-1 px-2 hover:bg-eden-primary/5 cursor-pointer text-sm text-eden-text-primary transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        title={node.file?.name}
      >
        <span className="mr-2 flex-shrink-0 opacity-80 group-hover:opacity-100">
          {getFileIcon(node.name)}
        </span>
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-xs text-eden-text-secondary opacity-0 group-hover:opacity-100 flex-shrink-0">
          {node.file && (node.file.size / 1024).toFixed(0) + "KB"}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 hover:bg-eden-primary/5 cursor-pointer text-sm font-medium text-eden-text-primary transition-colors select-none group"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="mr-1 text-eden-text-secondary group-hover:text-eden-text-primary transition-colors">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="mr-2 text-yellow-500 group-hover:text-yellow-600 transition-colors">
          {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {isExpanded &&
        node.children &&
        node.children.map((child) => (
          <FileTreeItem key={child.path} node={child} depth={depth + 1} />
        ))}
    </div>
  );
};

export function FileSidebar({ isOpen, onClose, files }: FileSidebarProps) {
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  return (
    <div
      className={`absolute top-0 right-0 h-full bg-white border-l border-eden-border shadow-xl z-20 transition-all duration-300 transform flex flex-col ${
        isOpen ? "translate-x-0 w-80 opacity-100" : "translate-x-full w-0 opacity-0"
      }`}
    >
      <div className="h-10 px-4 flex items-center justify-between border-b border-eden-border bg-[#F9FAFB]">
        <span className="text-xs font-bold text-eden-text-secondary uppercase tracking-wider">
          Explorer
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded text-eden-text-secondary transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-eden-text-secondary">
            <span className="text-sm">No open files</span>
          </div>
        ) : (
          <div className="select-none">
            {fileTree.map((node) => (
              <FileTreeItem key={node.path} node={node} />
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-eden-border bg-[#F9FAFB] text-xs text-eden-text-secondary">
        {files.length} files selected
      </div>
    </div>
  );
}
