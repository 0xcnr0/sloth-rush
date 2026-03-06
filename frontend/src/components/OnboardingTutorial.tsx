import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  {
    title: 'Mint Your Free Sloth',
    description: 'Connect your wallet and mint a Free Sloth to get started. It\'s gasless and completely free!',
    icon: '\u{1F9A5}',
    cta: 'Go to Mint',
    path: '/mint',
  },
  {
    title: 'Visit Your Treehouse',
    description: 'Check out your sloth\'s stats, upgrade and evolve, and manage your collection.',
    icon: '\u{1F3DA}\uFE0F',
    cta: 'Go to Treehouse',
    path: '/treehouse',
  },
  {
    title: 'Enter Your First Race',
    description: 'Join an Exhibition race for free, or enter a Standard Race to win ZZZ Coins!',
    icon: '\u{1F3C1}',
    cta: 'Go to Race',
    path: '/race',
  },
  {
    title: 'Train & Evolve',
    description: 'Train your Sloth to boost stats, play mini games, and evolve through 4 tiers! Check your Treehouse for training options.',
    icon: '\u{1F4AA}',
    cta: 'Start Playing!',
    path: '/treehouse',
  },
]

const STORAGE_KEY = 'sloth-rush-onboarded'

export default function OnboardingTutorial() {
  const navigate = useNavigate()
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const onboarded = localStorage.getItem(STORAGE_KEY)
    if (!onboarded) setShow(true)
  }, [])

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
  }

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleSkip()
    }
  }

  function handleCTA() {
    const currentStep = STEPS[step]
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
    if (currentStep.path) {
      navigate(currentStep.path)
    }
  }

  if (!show) return null

  const currentStep = STEPS[step]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      >
        <motion.div
          key={step}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="bg-sloth-card border border-sloth-border rounded-2xl p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="text-6xl mb-4"
          >
            {currentStep.icon}
          </motion.div>

          <h2 className="text-2xl font-bold text-white mb-2">{currentStep.title}</h2>
          <p className="text-gray-400 text-sm mb-6">{currentStep.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-sloth-green' : i < step ? 'bg-sloth-green/40' : 'bg-sloth-border'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 py-2.5 text-gray-500 hover:text-white transition-colors text-sm cursor-pointer"
            >
              Skip
            </button>
            {step < STEPS.length - 1 ? (
              <>
                <button
                  onClick={handleCTA}
                  className="flex-1 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer text-sm"
                >
                  {currentStep.cta}
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-2.5 bg-sloth-card border border-sloth-border text-white font-semibold rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-sm"
                >
                  Next
                </button>
              </>
            ) : (
              <button
                onClick={handleSkip}
                className="flex-[2] py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer text-sm"
              >
                {currentStep.cta}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
