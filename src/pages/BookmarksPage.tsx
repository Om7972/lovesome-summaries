import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Trash2,
  Search,
  Copy,
  ExternalLink,
  Download,
  FileJson,
  FileText,
  StickyNote,
  CheckSquare,
  Square,
  X,
  Calendar,
  ArrowUpDown,
  Filter,
  TrendingUp,
  Clock,
  FileType,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { downloadJSON, downloadTextAsPDF } from "@/lib/export-utils";

type Importance = "high" | "medium" | "low";
type SortKey = "newest" | "oldest" | "importance" | "source";

interface BookmarkRow {
  id: string;
  summary_id: string;
  user_id: string;
  timestamp: string;
  description: string;
  importance: Importance;
  created_at: string;
  summaries?: { original_source: string | null; type: string | null } | null;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const importanceBadge: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const importanceWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

const NOTES_KEY = "bookmark_notes_v1";
const loadNotes = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveNotes = (n: Record<string, string>) =>
  localStorage.setItem(NOTES_KEY, JSON.stringify(n));

const PAGE_SIZE = 12;

export default function BookmarksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);

  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [activeNoteBookmark, setActiveNoteBookmark] = useState<BookmarkRow | null>(null);
  const [draftNote, setDraftNote] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<
    null | { ids: string[]; label: string }
  >(null);

  // Fetch
  const fetchBookmarks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("highlights")
      .select("*, summaries(original_source, type)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load bookmarks");
    setBookmarks((data as BookmarkRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Reset paging when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, importanceFilter, typeFilter, dateFrom, dateTo, sort]);

  const sourceTypes = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach((b) => b.summaries?.type && set.add(b.summaries.type));
    return Array.from(set);
  }, [bookmarks]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    const term = debouncedSearch;
    const arr = bookmarks.filter((h) => {
      if (importanceFilter !== "all" && h.importance !== importanceFilter) return false;
      if (typeFilter !== "all" && h.summaries?.type !== typeFilter) return false;
      const t = new Date(h.created_at).getTime();
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      if (term) {
        const note = (notes[h.id] || "").toLowerCase();
        const src = (h.summaries?.original_source || "").toLowerCase();
        if (
          !h.description.toLowerCase().includes(term) &&
          !note.includes(term) &&
          !src.includes(term)
        )
          return false;
      }
      return true;
    });
    arr.sort((a, b) => {
      if (sort === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "importance")
        return (importanceWeight[b.importance] || 0) - (importanceWeight[a.importance] || 0);
      if (sort === "source")
        return (a.summaries?.original_source || "").localeCompare(
          b.summaries?.original_source || "",
        );
      return 0;
    });
    return arr;
  }, [bookmarks, importanceFilter, typeFilter, dateFrom, dateTo, debouncedSearch, sort, notes]);

  const visible = filtered.slice(0, visibleCount);

  // Stats
  const stats = useMemo(() => {
    const total = bookmarks.length;
    const byImp = { high: 0, medium: 0, low: 0 } as Record<Importance, number>;
    bookmarks.forEach((b) => {
      byImp[b.importance] = (byImp[b.importance] || 0) + 1;
    });
    const sources = new Set(bookmarks.map((b) => b.summary_id));
    return { total, byImp, sources: sources.size };
  }, [bookmarks]);

  const hasActiveFilters =
    !!debouncedSearch ||
    importanceFilter !== "all" ||
    typeFilter !== "all" ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = () => {
    setSearch("");
    setImportanceFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Actions
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelected(new Set(visible.map((v) => v.id)));
  const clearSelection = () => setSelected(new Set());

  const requestDelete = (ids: string[]) => {
    if (!ids.length) return;
    setConfirmDelete({
      ids,
      label: ids.length === 1 ? "this bookmark" : `${ids.length} bookmarks`,
    });
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    const { ids } = confirmDelete;
    const { error } = await supabase.from("highlights").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    setBookmarks((prev) => prev.filter((b) => !ids.includes(b.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.delete(i));
      return next;
    });
    // remove notes
    const n = { ...notes };
    ids.forEach((i) => delete n[i]);
    setNotes(n);
    saveNotes(n);
    toast.success(`Removed ${ids.length} bookmark${ids.length > 1 ? "s" : ""}`);
    setConfirmDelete(null);
  };

  const copyOne = async (b: BookmarkRow) => {
    try {
      await navigator.clipboard.writeText(b.description);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const copySelected = async () => {
    const text = bookmarks
      .filter((b) => selected.has(b.id))
      .map((b) => `• ${b.description}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied selection");
    } catch {
      toast.error("Copy failed");
    }
  };

  const openSource = (b: BookmarkRow) => {
    if (b.summary_id) navigate(`/history?highlight=${b.summary_id}`);
  };

  const openNote = (b: BookmarkRow) => {
    setActiveNoteBookmark(b);
    setDraftNote(notes[b.id] || "");
    setNoteSheetOpen(true);
  };

  const saveNote = () => {
    if (!activeNoteBookmark) return;
    const next = { ...notes };
    if (draftNote.trim()) next[activeNoteBookmark.id] = draftNote.trim();
    else delete next[activeNoteBookmark.id];
    setNotes(next);
    saveNotes(next);
    toast.success("Note saved");
    setNoteSheetOpen(false);
  };

  // Exports
  const buildExportRows = (rows: BookmarkRow[]) =>
    rows.map((b) => ({
      description: b.description,
      importance: b.importance,
      timestamp: b.timestamp || "",
      source: b.summaries?.original_source || "",
      type: b.summaries?.type || "",
      note: notes[b.id] || "",
      created_at: b.created_at,
    }));

  const exportJson = () => {
    const rows = selected.size
      ? bookmarks.filter((b) => selected.has(b.id))
      : filtered;
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadJSON(
      { exportedAt: new Date().toISOString(), count: rows.length, bookmarks: buildExportRows(rows) },
      "bookmarks-export",
    );
    toast.success(`Exported ${rows.length} bookmark${rows.length > 1 ? "s" : ""}`);
  };

  const exportCsv = () => {
    const rows = selected.size
      ? bookmarks.filter((b) => selected.has(b.id))
      : filtered;
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const cols = ["description", "importance", "timestamp", "source", "type", "note", "created_at"];
    const escape = (v: string) => `"${(v || "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const data = buildExportRows(rows);
    const csv = [
      cols.join(","),
      ...data.map((r) => cols.map((c) => escape(String((r as any)[c] ?? ""))).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bookmarks-export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} bookmark${rows.length > 1 ? "s" : ""}`);
  };

  const exportPdf = () => {
    const rows = selected.size
      ? bookmarks.filter((b) => selected.has(b.id))
      : filtered;
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    downloadTextAsPDF(
      "My Bookmarks",
      rows.map((b, i) => ({
        heading: `#${i + 1} · ${b.summaries?.original_source || "Untitled source"}`,
        content: `<p><span class="badge">${b.importance}</span>${
          b.summaries?.type ? `<span class="badge">${b.summaries.type}</span>` : ""
        }${b.timestamp ? `<span class="badge">${b.timestamp}</span>` : ""}</p>
          <p>${b.description}</p>
          ${notes[b.id] ? `<p><em>Note:</em> ${notes[b.id]}</p>` : ""}`,
      })),
      "bookmarks",
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">Bookmarks</h1>
            <p className="text-muted-foreground text-sm">
              Your saved insights and highlights — searchable, exportable, annotated
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={!bookmarks.length}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">
              {selected.size ? `${selected.size} selected` : `${filtered.length} filtered`}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportJson} className="gap-2 text-xs">
              <FileJson className="h-3.5 w-3.5" /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv} className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf} className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" /> Export PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Bookmark className="h-4 w-4" />} label="Total" value={stats.total} />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-destructive" />}
          label="High priority"
          value={stats.byImp.high}
        />
        <StatCard
          icon={<FileType className="h-4 w-4 text-primary" />}
          label="Sources"
          value={stats.sources}
        />
        <StatCard
          icon={<StickyNote className="h-4 w-4 text-primary" />}
          label="With notes"
          value={Object.keys(notes).filter((k) => bookmarks.some((b) => b.id === k)).length}
        />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search descriptions, notes, sources..."
                  className="pl-9"
                />
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-[160px]">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="importance">By importance</SelectItem>
                  <SelectItem value="source">By source</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={importanceFilter} onValueChange={setImportanceFilter}>
                <SelectTrigger>
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Importance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All importance</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <FileType className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sourceTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-9"
                  aria-label="From date"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="pl-9"
                  aria-label="To date"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {bookmarks.length}
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1">
                  <X className="h-3 w-3" /> Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-2 z-20"
          >
            <Card className="border-primary/30 bg-primary/5 backdrop-blur-md">
              <CardContent className="p-3 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selected.size} selected</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={selectAllVisible} className="text-xs">
                    Select all visible
                  </Button>
                  <Button size="sm" variant="outline" onClick={copySelected} className="text-xs gap-1">
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => requestDelete(Array.from(selected))}
                    className="text-xs gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection} className="text-xs">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          description="Save insights from your highlights and they'll appear here."
          actionLabel="Browse highlights"
          onAction={() => navigate("/highlights")}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Try adjusting your filters or search term."
          actionLabel="Clear filters"
          onAction={clearFilters}
        />
      ) : (
        <>
          <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2">
            {visible.map((h) => {
              const isSelected = selected.has(h.id);
              const hasNote = !!notes[h.id];
              return (
                <motion.div
                  key={h.id}
                  variants={itemVariants}
                  layout
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                >
                  <Card
                    className={`border-border/50 bg-card/80 backdrop-blur-sm h-full transition-colors ${
                      isSelected ? "ring-2 ring-primary/60" : ""
                    }`}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleSelect(h.id)}
                          className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                          aria-label={isSelected ? "Deselect" : "Select"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <p className="text-sm leading-relaxed flex-1">{h.description}</p>
                      </div>

                      {hasNote && (
                        <div className="text-xs bg-muted/50 border border-border/40 rounded-md p-2 text-muted-foreground flex gap-2">
                          <StickyNote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span className="line-clamp-2 italic">{notes[h.id]}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs capitalize ${importanceBadge[h.importance] || ""}`}>
                          {h.importance}
                        </Badge>
                        {h.summaries?.type && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {h.summaries.type}
                          </Badge>
                        )}
                        {h.timestamp && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Clock className="h-3 w-3" />
                            {h.timestamp}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(h.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {h.summaries?.original_source && (
                        <p className="text-xs text-muted-foreground truncate" title={h.summaries.original_source}>
                          Source: {h.summaries.original_source}
                        </p>
                      )}

                      <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => copyOne(h)}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => openNote(h)}
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                          {hasNote ? "Edit note" : "Note"}
                        </Button>
                        {h.summary_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => openSource(h)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Source
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() => requestDelete([h.id])}
                          aria-label="Delete bookmark"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="gap-2"
              >
                Load more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Note sheet */}
      <Sheet open={noteSheetOpen} onOpenChange={setNoteSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              Personal note
            </SheetTitle>
            <SheetDescription>
              Notes are stored privately in your browser and included when you export.
            </SheetDescription>
          </SheetHeader>
          {activeNoteBookmark && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
                {activeNoteBookmark.description}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-text">Your note</Label>
                <Textarea
                  id="note-text"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Write context, takeaways, or follow-ups..."
                  rows={8}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setNoteSheetOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveNote}>Save note</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can't be undone. The bookmark and any personal note will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 border border-dashed border-border/60 rounded-lg bg-card/40"
    >
      <Bookmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <Button variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </motion.div>
  );
}
