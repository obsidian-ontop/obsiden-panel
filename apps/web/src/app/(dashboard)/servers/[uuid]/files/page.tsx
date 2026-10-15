'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Folder,
  File,
  ChevronRight,
  Upload,
  Plus,
  Trash2,
  Edit,
  FolderPlus,
  Download,
  FileArchive,
  Save,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import { Card } from '../../../../../components/ui/card';
import { formatBytes } from '../../../../../lib/utils';

interface WingsFile {
  name: string;
  size: number;
  directory: boolean;
  file: boolean;
  symlink: boolean;
  mime: string;
  modified: string;
}

export default function ServerFilesPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();
  const [currentDirectory, setCurrentDirectory] = useState('/');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  // List files query
  const { data: files, isLoading, refetch } = useQuery<WingsFile[]>({
    queryKey: ['server-files', uuid, currentDirectory],
    queryFn: () =>
      fetchApi(`/api/client/servers/${uuid}/files/list?directory=${encodeURIComponent(currentDirectory)}`),
  });

  // Save file mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/client/servers/${uuid}/files/write?file=${encodeURIComponent(selectedFile!)}`, {
        method: 'POST',
        body: JSON.stringify({ content: fileContent }),
      }),
    onSuccess: () => {
      setIsEditing(false);
      setSelectedFile(null);
      refetch();
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: (fileName: string) =>
      fetchApi(`/api/client/servers/${uuid}/files/delete`, {
        method: 'POST',
        body: JSON.stringify({
          root: currentDirectory,
          files: [fileName],
        }),
      }),
    onSuccess: () => {
      refetch();
    },
  });

  const handleOpenFile = async (file: WingsFile) => {
    if (file.directory) {
      const nextDir = currentDirectory === '/' ? `/${file.name}` : `${currentDirectory}/${file.name}`;
      setCurrentDirectory(nextDir);
    } else {
      const filePath = currentDirectory === '/' ? `/${file.name}` : `${currentDirectory}/${file.name}`;
      try {
        const text = await fetchApi<string>(
          `/api/client/servers/${uuid}/files/contents?file=${encodeURIComponent(filePath)}`,
        );
        setSelectedFile(filePath);
        setFileContent(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
        setIsEditing(true);
      } catch (err: any) {
        alert(`Failed to read file: ${err.message}`);
      }
    }
  };

  const breadcrumbs = currentDirectory.split('/').filter(Boolean);

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentDirectory('/');
      return;
    }
    const path = '/' + breadcrumbs.slice(0, index + 1).join('/');
    setCurrentDirectory(path);
  };

  return (
    <div className="space-y-4">
      {/* File Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-card shadow-2xl flex flex-col h-[80vh] overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface-elevated">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-medium text-text-primary">
                  {selectedFile}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <Save className="w-3.5 h-3.5" /> Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedFile(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              className="flex-1 p-4 bg-[#090909] text-text-primary font-mono text-xs resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Action Bar & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface border border-border rounded-card p-3.5">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <Folder className="w-3.5 h-3.5 text-primary" /> /root
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`hover:text-text-primary transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'text-text-primary font-semibold' : 'text-text-muted'
                }`}
              >
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const name = prompt('Enter new file name:');
              if (name) {
                const path = currentDirectory === '/' ? `/${name}` : `${currentDirectory}/${name}`;
                setSelectedFile(path);
                setFileContent('');
                setIsEditing(true);
              }
            }}
          >
            <Plus className="w-3.5 h-3.5" /> New File
          </Button>
        </div>
      </div>

      {/* File Browser Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading directory contents...</div>
        ) : (files || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            This directory is empty
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3">Modified</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {files?.map((file) => (
                <tr
                  key={file.name}
                  className="hover:bg-surface-elevated/30 transition-colors group cursor-pointer"
                  onClick={() => handleOpenFile(file)}
                >
                  <td className="px-5 py-3 flex items-center gap-2.5 font-medium text-text-primary">
                    {file.directory ? (
                      <Folder className="w-4 h-4 text-primary fill-primary/10" />
                    ) : (
                      <File className="w-4 h-4 text-text-muted" />
                    )}
                    <span className="group-hover:text-primary transition-colors">
                      {file.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-text-secondary text-[11px]">
                    {file.directory ? '-' : formatBytes(file.size)}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-muted text-[11px]">
                    {new Date(file.modified).toLocaleDateString()}
                  </td>
                  <td
                    className="px-5 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${file.name}?`)) {
                          deleteMutation.mutate(file.name);
                        }
                      }}
                      className="p-1 text-text-muted hover:text-status-error transition-colors rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
