import { motion } from "framer-motion";
import { Check, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for trying out Lovesome Summaries",
    features: [
      "5 summaries per day",
      "PDF summarization",
      "YouTube link support",
      "Interactive Q&A",
      "Text export",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    desc: "For professionals who need more power",
    features: [
      "Unlimited summaries",
      "Priority AI processing",
      "Video file upload",
      "Bullet & paragraph modes",
      "Summary history",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    desc: "For teams that collaborate on content",
    features: [
      "Everything in Pro",
      "5 team members",
      "Shared workspace",
      "Admin dashboard",
      "API access",
      "Custom branding",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export function PricingSection() {
  const { user, profile, refreshUsage } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanClick = async (plan: typeof plans[0]) => {
    if (plan.name === "Free") {
      if (user) {
        toast({
          title: "Plan Status",
          description: profile?.is_premium 
            ? "You are currently on the Pro plan." 
            : "You are already using the Free plan.",
        });
      } else {
        navigate("/register");
      }
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to subscribe.",
      });
      navigate("/login");
      return;
    }

    if (profile?.is_premium) {
      toast({
        title: "Already Subscribed",
        description: "You already have an active subscription.",
      });
      return;
    }

    setLoadingPlan(plan.name);

    // Get currency and price
    const currency = import.meta.env.VITE_RAZORPAY_CURRENCY || "INR";
    let amount = 0;
    
    if (plan.name === "Pro") {
      const proAmt = import.meta.env.VITE_RAZORPAY_AMOUNT_PRO || "1599";
      amount = parseInt(proAmt) * 100;
    } else if (plan.name === "Team") {
      const teamAmt = import.meta.env.VITE_RAZORPAY_AMOUNT_TEAM || "3999";
      amount = parseInt(teamAmt) * 100;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_pDeh9vFv7o8nSj",
      amount: amount,
      currency: currency,
      name: "Lovesome Summaries",
      description: `${plan.name} Subscription`,
      image: "/src/assets/Lovesome.svg",
      prefill: {
        name: profile?.full_name || "",
        email: profile?.email || "",
      },
      theme: {
        color: "#9b87f5",
      },
      handler: async function (response: any) {
        try {
          // Update profile in supabase
          const { error } = await supabase
            .from("profiles")
            .update({ is_premium: true, updated_at: new Date().toISOString() })
            .eq("id", user.id);

          if (error) throw error;

          toast({
            title: "Subscription Activated",
            description: `You have successfully upgraded to ${plan.name}!`,
          });
          
          if (refreshUsage) {
            await refreshUsage();
          }

          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (err: any) {
          console.error("Database update error:", err);
          toast({
            title: "Activation Failed",
            description: "Payment was successful, but we could not update your account. Please contact support.",
            variant: "destructive",
          });
        } finally {
          setLoadingPlan(null);
        }
      },
      modal: {
        ondismiss: function () {
          setLoadingPlan(null);
          toast({
            title: "Payment Cancelled",
            description: "The payment flow was cancelled.",
            variant: "destructive",
          });
        },
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay initiation error:", err);
      toast({
        title: "Checkout Error",
        description: "Failed to load payment gateway. Please check your network connection.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  };

  return (
    <section className="py-24 relative" id="pricing">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you need more
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className={`relative glass-card-strong p-8 flex flex-col ${
                plan.popular ? "ring-2 ring-primary shadow-glow scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-4 py-1.5 rounded-full animated-gradient text-primary-foreground text-sm font-semibold">
                  <Star className="h-3.5 w-3.5" />
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold font-display mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold font-display">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.desc}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((feature, fi) => (
                  <li key={fi} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  plan.popular
                    ? "animated-gradient text-primary-foreground btn-glow"
                    : "glass-card hover:bg-muted/50"
                }`}
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handlePlanClick(plan)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {plan.name === "Free" 
                  ? (user && !profile?.is_premium ? "Active Plan" : "Get Started") 
                  : (profile?.is_premium && plan.name === "Pro" ? "Current Plan" : plan.cta)}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
