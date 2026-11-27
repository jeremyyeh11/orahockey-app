'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { unwrap } from '@/lib/action-result'
import { finishTour, markWhatsNewSeen } from '@/app/dashboard/profile/actions'
import type { OnboardingState } from '@/lib/onboarding-server'
import { OPEN_WHATS_NEW_EVENT, START_TOUR_EVENT, tourSteps } from '@/lib/tour'
import { allReleases, unseenReleases, type Release } from '@/lib/whats-new'
import Tour from './Tour'
import WhatsNew from './WhatsNew'

/**
 * Decides what a player sees on load, rendered once by the app shell:
 *  - a new account (no player_onboarding row): the tour, on Home
 *  - otherwise, releases they haven't seen: the What's new modal
 * Finishing either is saved (finishTour / markWhatsNewSeen) so it shows once.
 * The tour runs on Home, so starting it elsewhere goes there first.
 */
export default function Onboarding({
  state,
  isAdmin,
  homeHref,
}: {
  state: OnboardingState | null
  isAdmin: boolean
  homeHref: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [touring, setTouring] = useState(false)
  // Tour asked for while not on Home: start it once Home has rendered
  const [tourPending, setTourPending] = useState(() => !!state?.isNew)
  const [releases, setReleases] = useState<Release[]>(() =>
    state && !state.isNew ? unseenReleases(state.seenRelease, isAdmin) : []
  )
  const [unseen, setUnseen] = useState(() => releases.length > 0)

  const save = useCallback((fn: () => Promise<unknown>) => {
    // Best effort: if saving fails it simply shows again next time
    fn().catch(() => {})
  }, [])

  const requestTour = useCallback(() => {
    setTourPending(true)
    if (pathname !== homeHref) router.push(homeHref)
  }, [pathname, homeHref, router])

  // Start a pending tour once Home's content (data-tour="home") is on the page
  useEffect(() => {
    if (!tourPending || pathname !== homeHref) return
    let tries = 0
    const timer = window.setInterval(() => {
      if (document.querySelector('[data-tour="home"]') || ++tries > 50) {
        window.clearInterval(timer)
        setTourPending(false)
        if (tries <= 50) {
          window.scrollTo({ top: 0 })
          setTouring(true)
        }
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [tourPending, pathname, homeHref])

  useEffect(() => {
    const onTour = () => {
      setReleases([])
      requestTour()
    }
    const onWhatsNew = () => setReleases(allReleases(isAdmin))
    window.addEventListener(START_TOUR_EVENT, onTour)
    window.addEventListener(OPEN_WHATS_NEW_EVENT, onWhatsNew)
    return () => {
      window.removeEventListener(START_TOUR_EVENT, onTour)
      window.removeEventListener(OPEN_WHATS_NEW_EVENT, onWhatsNew)
    }
  }, [requestTour, isAdmin])

  if (!state) return null

  function closeWhatsNew() {
    setReleases([])
    if (unseen) {
      setUnseen(false)
      save(() => unwrap(markWhatsNewSeen()))
    }
  }

  function endTour() {
    setTouring(false)
    window.scrollTo({ top: 0 })
    save(() => unwrap(finishTour()))
  }

  return (
    <>
      {releases.length > 0 && !touring && (
        <WhatsNew
          releases={releases}
          onClose={closeWhatsNew}
          onTour={() => {
            closeWhatsNew()
            requestTour()
          }}
        />
      )}
      {touring && <Tour steps={tourSteps(isAdmin)} onDone={endTour} />}
    </>
  )
}
