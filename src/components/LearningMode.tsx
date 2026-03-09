import { useState } from "react";
import { BookOpen, Brain, GraduationCap, ChevronLeft, ChevronRight, Check, X, Loader2, RefreshCw, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LearningModeProps {
  text: string;
  summary: string;
}

interface Flashcard {
  question: string;
  answer: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export function LearningMode({ text, summary }: LearningModeProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [studyNotes, setStudyNotes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  // Flashcard state
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());

  const { toast } = useToast();

  const generate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { text, summary },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      setFlashcards(data.flashcards || []);
      setQuizQuestions(data.quiz_questions || []);
      setStudyNotes(data.study_notes || []);
      setIsGenerated(true);
      setCurrentCard(0);
      setCurrentQuestion(0);
      setQuizScore(0);
      setAnsweredQuestions(new Set());
      setShowAnswer(false);
      setSelectedAnswer(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate learning materials", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizAnswer = (answer: string) => {
    if (answeredQuestions.has(currentQuestion)) return;
    setSelectedAnswer(answer);
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestion));
    if (answer === quizQuestions[currentQuestion].correct_answer) {
      setQuizScore(prev => prev + 1);
    }
  };

  if (!isGenerated) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-8 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="p-4 rounded-full bg-primary/10">
              <GraduationCap className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-display">AI Learning Mode</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Generate quiz questions, flashcards, and study notes from your content
            </p>
            <Button onClick={generate} disabled={isLoading} className="animated-gradient text-primary-foreground btn-glow gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {isLoading ? "Generating..." : "Generate Learning Materials"}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 bg-gradient-card backdrop-blur-sm border-border/50 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-display">📚 Study Mode</h2>
          </div>
          <Button variant="outline" size="sm" onClick={generate} disabled={isLoading} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </Button>
        </div>

        <Tabs defaultValue="flashcards">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
            <TabsTrigger value="flashcards" className="gap-2 text-xs font-semibold">
              <BookOpen className="h-3.5 w-3.5" /> Flashcards ({flashcards.length})
            </TabsTrigger>
            <TabsTrigger value="quiz" className="gap-2 text-xs font-semibold">
              <Brain className="h-3.5 w-3.5" /> Quiz ({quizQuestions.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 text-xs font-semibold">
              <StickyNote className="h-3.5 w-3.5" /> Notes ({studyNotes.length})
            </TabsTrigger>
          </TabsList>

          {/* Flashcards */}
          <TabsContent value="flashcards">
            {flashcards.length > 0 && (
              <div className="space-y-4">
                <div className="text-center text-xs text-muted-foreground mb-2">
                  Card {currentCard + 1} of {flashcards.length}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentCard}-${showAnswer}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="min-h-[200px] rounded-xl border border-border/50 p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                    onClick={() => setShowAnswer(!showAnswer)}
                  >
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {showAnswer ? "Answer" : "Question"}
                    </p>
                    <p className="text-base font-medium leading-relaxed">
                      {showAnswer ? flashcards[currentCard].answer : flashcards[currentCard].question}
                    </p>
                    <p className="text-xs text-muted-foreground mt-4">Click to flip</p>
                  </motion.div>
                </AnimatePresence>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentCard(Math.max(0, currentCard - 1)); setShowAnswer(false); }}
                    disabled={currentCard === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); setShowAnswer(false); }}
                    disabled={currentCard === flashcards.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Quiz */}
          <TabsContent value="quiz">
            {quizQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Question {currentQuestion + 1} of {quizQuestions.length}</span>
                  <span className="font-semibold text-primary">Score: {quizScore}/{answeredQuestions.size}</span>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="font-medium text-sm mb-4">{quizQuestions[currentQuestion].question}</p>
                  <div className="space-y-2">
                    {quizQuestions[currentQuestion].options.map((option, i) => {
                      const isAnswered = answeredQuestions.has(currentQuestion);
                      const isCorrect = option === quizQuestions[currentQuestion].correct_answer;
                      const isSelected = option === selectedAnswer;
                      return (
                        <button
                          key={i}
                          onClick={() => handleQuizAnswer(option)}
                          disabled={isAnswered}
                          className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                            isAnswered && isCorrect
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : isAnswered && isSelected && !isCorrect
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isAnswered && isCorrect && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                            {isAnswered && isSelected && !isCorrect && <X className="h-4 w-4 text-destructive shrink-0" />}
                            <span>{option}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {answeredQuestions.has(currentQuestion) && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-muted-foreground">{quizQuestions[currentQuestion].explanation}</p>
                    </motion.div>
                  )}
                </div>
                <div className="flex justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => { setCurrentQuestion(Math.max(0, currentQuestion - 1)); setSelectedAnswer(null); }} disabled={currentQuestion === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setCurrentQuestion(Math.min(quizQuestions.length - 1, currentQuestion + 1)); setSelectedAnswer(null); }} disabled={currentQuestion === quizQuestions.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Study Notes */}
          <TabsContent value="notes">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {studyNotes.map((note, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <div className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 text-sm">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span className="text-foreground leading-relaxed">{note}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}
