import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { THEME } from '../config/theme'

const STEPS = [
  {
    title: `Mint Your ${THEME.tiers.free}`,
    description: `Connect your wallet and mint a ${THEME.tiers.free} to get started. It's gasless and completely free!`,
    icon: THEME.brand.mark,
    cta: 'Go to Mint',
    path: '/mint',
  },
  {
    title: `Visit Your ${THEME.locations.home}`,
    description: `Your shelf. Check stats, see how close the next form is, and how much your racer can still grow today.`,
    icon: '\u{1F3DA}\uFE0F',
    cta: `Go to ${THEME.locations.home}`,
    path: '/collection',
  },
  {
    title: 'Enter Your First Race',
    description: 'Pick a distance and race. Every finish grows your racer.',
    icon: '\u{1F3C1}',
    cta: 'Go to Race',
    path: '/race',
  },
  {
    // This step used to promise training and mini games and four tiers of
    // evolution to press a button for. Training and the mini games were cut
    // from V1 and evolution happens on its own — so the first thing a new
    // player read was a description of a game that does not exist.
    title: 'Watch It Change',
    description: `Stats decide the shape. Cross 90 in total and your toy becomes one of four characters — whichever stat you grew hardest picks which. No button, no fee.`,
    icon: '\u{2728}',
    cta: 'Start Playing!',
    path: '/collection',
  },
]

const STORAGE_KEY = 'onboarding-complete'

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
          className="bg-brand-surface border border-brand-border rounded-2xl p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="text-6xl mb-4"
          >
            {currentStep.icon}
          </motion.div>

          <h2 className="text-2xl font-bold text-brand-ink mb-2">{currentStep.title}</h2>
          <p className="text-brand-dust text-sm mb-6">{currentStep.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-brand-primary' : i < step ? 'bg-brand-primary/40' : 'bg-brand-border'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 py-2.5 text-brand-dust hover:text-brand-ink transition-colors text-sm cursor-pointer"
            >
              Skip
            </button>
            {step < STEPS.length - 1 ? (
              <>
                <button
                  onClick={handleCTA}
                  className="flex-1 py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer text-sm"
                >
                  {currentStep.cta}
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-2.5 bg-brand-surface border border-brand-border text-brand-ink font-semibold rounded-xl hover:bg-brand-ink/5 transition-colors cursor-pointer text-sm"
                >
                  Next
                </button>
              </>
            ) : (
              <button
                onClick={handleSkip}
                className="flex-[2] py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer text-sm"
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
