import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Brain, FileText, RotateCcw, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2, Sparkles, GraduationCap } from "lucide-react";
import { EmptyState, SummaryListSkeleton, GeneratingSkeleton } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Summary {
  id: string;
  original_source: string;
  summary_text: string;
  extracted_text: string;
  type: string;
  created_at: string;
}

interface Flashcard {
  question: string;
  answer: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

export default function StudyModePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Flashcard state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  const [activeTab, setActiveTab] = useState<"flashcards" | "quiz">("flashcards");

  useEffect(() => {
    if (user) fetchSummaries();
  }, [user]);

  const fetchSummaries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("summaries")
      .select("id, original_source, summary_text, extracted_text, type, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setSummaries((data as Summary[]) || []);
    setLoading(false);
  };

  const generateStudyMaterials = async (summary: Summary) => {
    setSelectedSummary(summary);
    setGeneratingCards(true);
    setGeneratingQuiz(true);
    setFlashcards([]);
    setQuizQuestions([]);
    setCurrentCard(0);
    setCurrentQuestion(0);
    setScore(0);
    setAnswered(0);
    setQuizComplete(false);
    setIsFlipped(false);
    setSelectedAnswer(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { text: summary.extracted_text || summary.summary_text, summary: summary.summary_text },
      });
      if (error) throw error;

      setFlashcards(data.flashcards || []);
      setQuizQuestions(data.questions || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to generate study materials.", variant: "destructive" });
    } finally {
      setGeneratingCards(false);
      setGeneratingQuiz(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    const correct = option === quizQuestions[currentQuestion].answer;
    if (correct) setScore(s => s + 1);
    setAnswered(a => a + 1);
  };

  const nextQuestion = () => {
    if (currentQuestion + 1 >= quizQuestions.length) {
      setQuizComplete(true);
    } else {
      setCurrentQuestion(q => q + 1);
      setSelectedAnswer(null);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setAnswered(0);
    setQuizComplete(false);
    setSelectedAnswer(null);
  };

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
          <p className="text-muted-foreground mt-2">Select a summary to generate flashcards and quizzes</p>
        </div>

        {loading ? (
          <SummaryListSkeleton count={6} />
        ) : summaries.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No summaries to study"
            description="Create your first summary from the Dashboard, then come back here to generate flashcards and quizzes."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summaries.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card
                  className="glass-card p-6 cursor-pointer hover:border-primary/40 transition-all group"
                  onClick={() => generateStudyMaterials(s)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.original_source || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">{s.type} · {new Date(s.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.summary_text.substring(0, 120)}...</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
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
          <h1 className="text-2xl font-bold font-display">{selectedSummary.original_source || "Study Session"}</h1>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "flashcards" ? "default" : "outline"}
          onClick={() => setActiveTab("flashcards")}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" /> Flashcards {flashcards.length > 0 && `(${flashcards.length})`}
        </Button>
        <Button
          variant={activeTab === "quiz" ? "default" : "outline"}
          onClick={() => setActiveTab("quiz")}
          className="gap-2"
        >
          <Brain className="h-4 w-4" /> Quiz {quizQuestions.length > 0 && `(${quizQuestions.length})`}
        </Button>
      </div>

      {/* Flashcards Section */}
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Card {currentCard + 1} of {flashcards.length}
                </span>
                <Progress value={((currentCard + 1) / flashcards.length) * 100} className="w-48 h-2" />
              </div>

              <div
                className="perspective-1000 cursor-pointer mx-auto max-w-xl"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentCard}-${isFlipped}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className={`glass-card-strong p-12 min-h-[280px] flex flex-col items-center justify-center text-center ${isFlipped ? 'border-primary/30' : ''}`}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                        {isFlipped ? "Answer" : "Question"}
                      </span>
                      <p className="text-lg font-medium leading-relaxed">
                        {isFlipped ? flashcards[currentCard].answer : flashcards[currentCard].question}
                      </p>
                      <p className="text-xs text-muted-foreground mt-6">Click to flip</p>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentCard === 0}
                  onClick={() => { setCurrentCard(c => c - 1); setIsFlipped(false); }}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentCard === flashcards.length - 1}
                  onClick={() => { setCurrentCard(c => c + 1); setIsFlipped(false); }}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quiz Section */}
      {activeTab === "quiz" && (
        <div>
          {generatingQuiz ? (
            <Card className="glass-card p-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Generating quiz questions...</p>
            </Card>
          ) : quizComplete ? (
            <Card className="glass-card-strong p-12 text-center max-w-xl mx-auto">
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold font-display mb-2">Quiz Complete!</h2>
              <p className="text-4xl font-bold gradient-text mb-2">{score}/{quizQuestions.length}</p>
              <p className="text-muted-foreground mb-6">
                {score === quizQuestions.length ? "Perfect score! 🎉" : score >= quizQuestions.length * 0.7 ? "Great job! 🌟" : "Keep studying! 📚"}
              </p>
              <Button onClick={resetQuiz} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Retake Quiz
              </Button>
            </Card>
          ) : quizQuestions.length === 0 ? (
            <Card className="glass-card p-12 text-center">
              <p className="text-muted-foreground">No quiz questions generated yet.</p>
            </Card>
          ) : (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Question {currentQuestion + 1} of {quizQuestions.length}
                </span>
                <span className="text-sm font-semibold text-primary">Score: {score}/{answered}</span>
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
                      <Button
                        key={i}
                        variant={variant}
                        className="w-full justify-start text-left h-auto py-3 px-4"
                        onClick={() => handleAnswer(option)}
                        disabled={!!selectedAnswer}
                      >
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
