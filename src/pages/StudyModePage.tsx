import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, FileText, RotateCcw, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2, Sparkles, GraduationCap, Youtube, Video, Search, Trophy, Target, Zap, Calendar, Clock, TrendingUp } from "lucide-react";
import { EmptyState, SummaryListSkeleton } from "@/components/EmptyState";
import { ExportMenu } from "@/components/ExportMenu";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportFlashcardsJSON, exportFlashcardsPDF } from "@/lib/export-utils";

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  extracted_text: string;
  type: string;
  created_at: string;
  word_count: number;
}

interface Flashcard { question: string; answer: string; }
interface QuizQuestion { question: string; options: string[]; answer: string; }

interface CardReview {
  card_index: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
}

const typeIcons: Record<string, any> = { pdf: FileText, youtube: Youtube, video: Video };
const typeColors: Record<string, string> = {
  pdf: "bg-primary/10 text-primary",
  youtube: "bg-destructive/10 text-destructive",
  video: "bg-accent/10 text-accent",
};

// SM-2 algorithm
function calculateSM2(quality: number, prev: { ease: number; interval: number; reps: number }) {
  let { ease, interval, reps } = prev;
  if (quality >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ease);
    reps += 1;
  } else {
    reps = 0;
    interval = 1;
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  return { ease, interval, reps };
}

export default function StudyModePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());

  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz">("flashcards");

  // Spaced repetition
  const [cardReviews, setCardReviews] = useState<Map<number, CardReview>>(new Map());
  const [dueCount, setDueCount] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [dueCards, setDueCards] = useState<number[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => { if (user) fetchSummaries(); }, [user]);

  const fetchSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("id, original_source, summary_text, extracted_text, type, created_at, word_count")
      .order("created_at", { ascending: false })
      .limit(50);
    setSummaries((data as Summary[]) || []);
    setLoading(false);
  };

  const fetchReviews = async (summaryId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("flashcard_reviews")
      .select("card_index, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at")
      .eq("summary_id", summaryId)
      .eq("user_id", user.id);
    const map = new Map<number, CardReview>();
    (data || []).forEach((r: any) => map.set(r.card_index, r));
    setCardReviews(map);
    const now = new Date();
    const due = (data || []).filter((r: any) => new Date(r.next_review_at) <= now).length;
    setDueCount(due);
  };

  const generateStudyMaterials = async (summary: Summary) => {
    setSelectedSummary(summary);
    setGeneratingCards(true);
    setGeneratingQuiz(true);
    setFlashcards([]); setQuizQuestions([]);
    setCurrentCard(0); setCurrentQuestion(0);
    setScore(0); setAnswered(0); setQuizComplete(false);
    setIsFlipped(false); setSelectedAnswer(null); setKnownCards(new Set());
    setReviewMode(false); setDueCards([]); setReviewIndex(0);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { text: summary.extracted_text || summary.summary_text, summary: summary.summary_text },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setFlashcards(data.flashcards || []);
      setQuizQuestions(data.quiz_questions || []);
      await fetchReviews(summary.id);
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate study materials.", variant: "destructive" });
    } finally {
      setGeneratingCards(false);
      setGeneratingQuiz(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    if (option === quizQuestions[currentQuestion].answer) setScore(s => s + 1);
    setAnswered(a => a + 1);
  };

  const nextQuestion = () => {
    if (currentQuestion + 1 >= quizQuestions.length) setQuizComplete(true);
    else { setCurrentQuestion(q => q + 1); setSelectedAnswer(null); }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0); setScore(0); setAnswered(0);
    setQuizComplete(false); setSelectedAnswer(null);
  };

  const toggleKnown = () => {
    setKnownCards(prev => {
      const next = new Set(prev);
      if (next.has(currentCard)) next.delete(currentCard);
      else next.add(currentCard);
      return next;
    });
  };

  // Spaced repetition: rate card quality (0-5)
  const rateCard = async (quality: number) => {
    if (!user || !selectedSummary) return;
    const idx = reviewMode ? dueCards[reviewIndex] : currentCard;
    const prev = cardReviews.get(idx);
    const sm2 = calculateSM2(quality, {
      ease: prev?.ease_factor ?? 2.5,
      interval: prev?.interval_days ?? 0,
      reps: prev?.repetitions ?? 0,
    });
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + sm2.interval);

    const reviewData = {
      user_id: user.id,
      summary_id: selectedSummary.id,
      card_index: idx,
      question: flashcards[idx]?.question || "",
      answer: flashcards[idx]?.answer || "",
      ease_factor: sm2.ease,
      interval_days: sm2.interval,
      repetitions: sm2.reps,
      next_review_at: nextReview.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    };

    await supabase.from("flashcard_reviews").upsert(reviewData, { onConflict: "user_id,summary_id,card_index" });

    setCardReviews(prev => {
      const next = new Map(prev);
      next.set(idx, {
        card_index: idx,
        ease_factor: sm2.ease,
        interval_days: sm2.interval,
        repetitions: sm2.reps,
        next_review_at: nextReview.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      });
      return next;
    });

    if (quality >= 3) {
      setKnownCards(prev => new Set(prev).add(idx));
    }

    // Advance card
    if (reviewMode) {
      if (reviewIndex + 1 < dueCards.length) {
        setReviewIndex(r => r + 1);
      } else {
        setReviewMode(false);
        toast({ title: "Review complete!", description: "All due cards reviewed." });
      }
    } else {
      if (currentCard < flashcards.length - 1) setCurrentCard(c => c + 1);
    }
    setIsFlipped(false);
  };

  const startReviewMode = () => {
    const now = new Date();
    const due: number[] = [];
    cardReviews.forEach((r, idx) => {
      if (new Date(r.next_review_at) <= now) due.push(idx);
    });
    // Also add cards never reviewed
    flashcards.forEach((_, idx) => {
      if (!cardReviews.has(idx) && !due.includes(idx)) due.push(idx);
    });
    setDueCards(due);
    setReviewIndex(0);
    setReviewMode(true);
    setIsFlipped(false);
  };

  const getCardStatus = (idx: number) => {
    const review = cardReviews.get(idx);
    if (!review) return { label: "New", color: "text-muted-foreground" };
    const now = new Date();
    if (new Date(review.next_review_at) <= now) return { label: "Due", color: "text-destructive" };
    if (review.repetitions >= 3) return { label: "Mastered", color: "text-primary" };
    return { label: `${review.interval_days}d`, color: "text-amber-500" };
  };

  const filtered = summaries.filter(s =>
    !search || s.original_source.toLowerCase().includes(search.toLowerCase())
  );

  const scorePercent = quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0;
  const activeCardIdx = reviewMode ? dueCards[reviewIndex] : currentCard;
  const activeCard = flashcards[activeCardIdx];
  const activeStatus = activeCard ? getCardStatus(activeCardIdx) : null;

  if (!selectedSummary) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-3">
            <div className="p-2.5 rounded-xl animated-gradient">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            Study Mode
          </h1>
          <p className="text-muted-foreground mt-2">Generate AI flashcards and quizzes from your summaries</p>
        </div>

        {loading ? (
          <SummaryListSkeleton count={6} />
        ) : summaries.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No summaries to study" description="Create your first summary from the Dashboard, then come back here to generate flashcards and quizzes." />
        ) : (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search summaries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: BookOpen, title: "Flashcards", desc: "Flip to reveal answers", color: "text-primary" },
                { icon: Brain, title: "Multiple Choice", desc: "Test your knowledge", color: "text-accent" },
              ].map((f, i) => (
                <Card key={i} className="glass-card p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <f.icon className={`h-4 w-4 ${f.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((s, i) => {
                const Icon = typeIcons[s.type] || FileText;
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="glass-card p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group" onClick={() => generateStudyMaterials(s)}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-xl shrink-0 ${typeColors[s.type] || "bg-primary/10 text-primary"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.original_source || "Untitled"}</p>
                          <p className="text-xs text-muted-foreground mt-1 capitalize">{s.type} · {new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">Generate Study Materials →</span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSummary(null)} className="gap-2 text-muted-foreground mb-2">
            <ChevronLeft className="h-4 w-4" /> Back to summaries
          </Button>
          <h1 className="text-2xl font-bold font-display truncate">{selectedSummary.original_source || "Study Session"}</h1>
        </div>
        {flashcards.length > 0 && (
          <ExportMenu
            onExportJSON={() => exportFlashcardsJSON(flashcards, selectedSummary.original_source)}
            onExportPDF={() => exportFlashcardsPDF(flashcards, selectedSummary.original_source)}
          />
        )}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        <Button variant={activeTab === "flashcards" ? "default" : "outline"} onClick={() => { setActiveTab("flashcards"); setReviewMode(false); }} className="gap-2">
          <BookOpen className="h-4 w-4" /> Flashcards {flashcards.length > 0 && `(${flashcards.length})`}
        </Button>
        <Button variant={activeTab === "quiz" ? "default" : "outline"} onClick={() => setActiveTab("quiz")} className="gap-2">
          <Brain className="h-4 w-4" /> Quiz {quizQuestions.length > 0 && `(${quizQuestions.length})`}
        </Button>
      </div>

      {/* Flashcards */}
      {activeTab === "flashcards" && (
        <div>
          {generatingCards ? (
            <Card className="glass-card p-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Generating flashcards...</p>
            </Card>
          ) : flashcards.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <p className="text-muted-foreground">No flashcards generated yet.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Spaced Repetition Stats Bar */}
              <Card className="glass-card p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Spaced Repetition</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> {flashcards.filter((_, i) => { const s = getCardStatus(i); return s.label === "Due" || s.label === "New"; }).length} due</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {flashcards.filter((_, i) => { const s = getCardStatus(i); return s.label !== "Due" && s.label !== "New" && s.label !== "Mastered"; }).length} learning</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> {flashcards.filter((_, i) => getCardStatus(i).label === "Mastered").length} mastered</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={startReviewMode} className="ml-auto gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5" /> Review Due Cards
                  </Button>
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {reviewMode ? `Review ${reviewIndex + 1} of ${dueCards.length}` : `Card ${currentCard + 1} of ${flashcards.length}`}
                  </span>
                  {activeStatus && (
                    <Badge variant="secondary" className={`text-xs gap-1 ${activeStatus.color}`}>
                      <Clock className="h-3 w-3" /> {activeStatus.label}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Target className="h-3 w-3" /> {knownCards.size}/{flashcards.length} mastered
                  </Badge>
                </div>
                <Progress value={((reviewMode ? reviewIndex + 1 : currentCard + 1) / (reviewMode ? dueCards.length : flashcards.length)) * 100} className="w-48 h-2" />
              </div>

              {activeCard && (
                <div className="perspective-1000 cursor-pointer mx-auto max-w-xl" onClick={() => setIsFlipped(!isFlipped)}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${activeCardIdx}-${isFlipped}`}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      exit={{ rotateY: -90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className={`glass-card-strong p-12 min-h-[280px] flex flex-col items-center justify-center text-center relative ${isFlipped ? "border-primary/30" : ""} ${knownCards.has(activeCardIdx) ? "ring-2 ring-primary/30" : ""}`}>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                          {isFlipped ? "Answer" : "Question"}
                        </span>
                        <p className="text-lg font-medium leading-relaxed">
                          {isFlipped ? activeCard.answer : activeCard.question}
                        </p>
                        <p className="text-xs text-muted-foreground mt-6">Click to flip</p>
                      </Card>
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Rating buttons (shown after flip) */}
              {isFlipped && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center gap-2">
                  <Button variant="destructive" size="sm" onClick={() => rateCard(1)} className="text-xs gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Again
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => rateCard(3)} className="text-xs gap-1">
                    <Clock className="h-3.5 w-3.5" /> Hard
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => rateCard(4)} className="text-xs gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Good
                  </Button>
                  <Button size="sm" onClick={() => rateCard(5)} className="text-xs gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Easy
                  </Button>
                </motion.div>
              )}

              {!reviewMode && !isFlipped && (
                <div className="flex justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={currentCard === 0} onClick={() => { setCurrentCard(c => c - 1); setIsFlipped(false); }}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button variant={knownCards.has(currentCard) ? "default" : "outline"} size="sm" onClick={toggleKnown} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> {knownCards.has(currentCard) ? "Mastered" : "Mark Known"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={currentCard === flashcards.length - 1} onClick={() => { setCurrentCard(c => c + 1); setIsFlipped(false); }}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quiz */}
      {activeTab === "quiz" && (
        <div>
          {generatingQuiz ? (
            <Card className="glass-card p-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Generating quiz questions...</p>
            </Card>
          ) : quizComplete ? (
            <Card className="glass-card-strong p-12 text-center max-w-xl mx-auto">
              <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold font-display mb-2">Quiz Complete!</h2>
              <p className="text-4xl font-bold gradient-text mb-1">{scorePercent}%</p>
              <p className="text-lg font-semibold mb-1">{score}/{quizQuestions.length} correct</p>
              <p className="text-muted-foreground mb-6">
                {scorePercent === 100 ? "Perfect score! 🎉" : scorePercent >= 70 ? "Great job! 🌟" : "Keep studying! 📚"}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={resetQuiz} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Retake Quiz
                </Button>
                <Button variant="outline" onClick={() => setActiveTab("flashcards")} className="gap-2">
                  <BookOpen className="h-4 w-4" /> Review Cards
                </Button>
              </div>
            </Card>
          ) : quizQuestions.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <p className="text-muted-foreground">No quiz questions generated yet.</p>
            </Card>
          ) : (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Question {currentQuestion + 1} of {quizQuestions.length}</span>
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" /> Score: {score}/{answered}
                </Badge>
              </div>
              <Progress value={((currentQuestion + 1) / quizQuestions.length) * 100} className="h-2" />

              <Card className="glass-card-strong p-8">
                <p className="text-lg font-medium mb-6">{quizQuestions[currentQuestion].question}</p>
                <div className="space-y-3">
                  {(quizQuestions[currentQuestion].options || []).map((option, i) => {
                    const isCorrect = option === quizQuestions[currentQuestion].answer;
                    const isSelected = option === selectedAnswer;
                    let variant: "outline" | "default" | "destructive" = "outline";
                    if (selectedAnswer) {
                      if (isCorrect) variant = "default";
                      else if (isSelected) variant = "destructive";
                    }
                    return (
                      <Button key={i} variant={variant} className="w-full justify-start text-left h-auto py-3 px-4" onClick={() => handleAnswer(option)} disabled={!!selectedAnswer}>
                        <span className="mr-3 font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                        {option}
                        {selectedAnswer && isCorrect && <CheckCircle2 className="h-4 w-4 ml-auto text-primary-foreground" />}
                        {selectedAnswer && isSelected && !isCorrect && <XCircle className="h-4 w-4 ml-auto" />}
                      </Button>
                    );
                  })}
                </div>
              </Card>

              {selectedAnswer && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Button onClick={nextQuestion} className="w-full gap-2">
                    {currentQuestion + 1 >= quizQuestions.length ? "See Results" : "Next Question"} <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
