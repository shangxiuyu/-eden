import React, { useState, useMemo, useEffect } from "react";
import {
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

interface FileExplorerViewProps {
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

  files.forEach((file) => {
    const pathParts = (file.webkitRelativePath || file.name).split("/");
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

  // Sort: Folders first, then files
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

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode size={16} className="text-gray-500" />;
    case "json":
      return <FileJson size={16} className="text-gray-500" />;
    case "md":
    case "txt":
      return <FileText size={16} className="text-gray-500" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
      return <FileImage size={16} className="text-gray-500" />;
    case "css":
    case "scss":
    case "less":
      return <FileCode size={16} className="text-gray-500" />;
    case "html":
      return <FileCode size={16} className="text-gray-500" />;
    default:
      return <FileIcon size={16} className="text-gray-400" />;
  }
}

const TreeItem = ({
  node,
  depth = 0,
  onSelect,
  selectedPath,
}: {
  node: TreeNode;
  depth?: number;
  onSelect: (node: TreeNode) => void;
  selectedPath: string | null;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = node.path === selectedPath;

  if (node.type === "file") {
    return (
      <div
        className={`flex items-center py-1.5 px-2 cursor-pointer text-sm transition-colors group ${
          isSelected
            ? "bg-eden-primary/10 text-eden-primary font-medium"
            : "text-eden-text-primary hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onSelect(node)}
      >
        <span
          className={`mr-2 flex-shrink-0 opacity-80 group-hover:opacity-100 ${isSelected ? "text-eden-primary" : "text-gray-500"}`}
        >
          {getFileIcon(node.name)}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex items-center py-1.5 px-2 cursor-pointer text-sm font-medium transition-colors select-none group ${"text-eden-text-primary hover:bg-gray-100"}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="mr-1 text-eden-text-secondary group-hover:text-eden-text-primary transition-colors">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="mr-2 text-gray-400 group-hover:text-gray-600 transition-colors">
          {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {isExpanded &&
        node.children &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        ))}
    </div>
  );
};

export function FileExplorerView({ files }: FileExplorerViewProps) {
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedNode?.file) {
      const file = selectedNode.file;

      // Simple check for text files
      const isText =
        file.type.startsWith("text") ||
        /\.(ts|tsx|js|jsx|json|md|txt|css|html|svg|xml|yaml|yml|sh)$/i.test(file.name);

      if (isText) {
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          setFileContent(e.target?.result as string);
          setIsLoading(false);
        };
        reader.onerror = () => {
          setFileContent("Error reading file.");
          setIsLoading(false);
        };
        reader.readAsText(file);
      } else if (file.type.startsWith("image")) {
        // Optionally handle images or binary
        setFileContent("[Image Preview Not Implemented Yet - Binary File]");
        setIsLoading(false);
      } else {
        setFileContent(`[Binary File: ${file.type}]`);
        setIsLoading(false);
      }
    } else {
      setFileContent("");
    }
  }, [selectedNode]);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-eden-text-secondary bg-[#FAFAFB]">
        <FolderOpen size={48} className="mb-4 opacity-20" />
        <p className="text-lg font-medium">No files selected</p>
        <p className="text-sm mt-2">Upload files/folders to view them here</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white divide-x divide-eden-border">
      {/* Sidebar: Tree */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-[#F9FAFB] h-full overflow-hidden border-r border-eden-border">
        {/* Header removed as requested */}
        <div className="flex-1 overflow-y-auto py-2">
          {fileTree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              onSelect={setSelectedNode}
              selectedPath={selectedNode?.path ?? null}
            />
          ))}
        </div>
      </div>

      {/* Main: Content */}
      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
        {selectedNode ? (
          <>
            <div className="h-10 px-4 flex items-center border-b border-eden-border bg-white sticky top-0">
              <span className="mr-2 opacity-70">{getFileIcon(selectedNode.name)}</span>
              <span className="font-medium text-sm text-eden-text-primary">
                {selectedNode.name}
              </span>
              <span className="ml-3 text-xs text-eden-text-secondary">
                {(selectedNode.file!.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-white">
              {isLoading ? (
                <div className="text-eden-text-secondary text-sm">Loading...</div>
              ) : (
                <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">
                  <code>{fileContent}</code>
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-eden-text-secondary">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FileCode size={32} className="opacity-20" />
            </div>
            <p className="text-sm">Select a file to view content</p>
          </div>
        )}
      </div>
    </div>
  );
}
