'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { unwrap } from '@/lib/action-result'
import { finishTour, markWhatsNewSeen } from '@/app/dashboard/profile/actions'
import type { OnboardingState } from '@/lib/onboarding-server'
import { OPEN_WHATS_NEW_EVENT, START_TOUR_EVENT, tourSteps } from '@/lib/tour'
import { allReleases, unseenReleases, type Release, type WhatsNewViewer } from '@/lib/whats-new'
import Tour from './Tour'
import WhatsNew from './WhatsNew'

/**
 * Decides what a player sees, rendered once by the app shell:
 *  - the tour, on Home, until they finish or skip it once (new and existing
 *    accounts alike); after that only Profile → Take the tour starts it
 *  - releases they haven't seen: the What's new modal, after the tour for an
 *    existing player (a new account's tour counts as seeing them)
 * Both are saved (finishTour / markWhatsNewSeen) so they show once.
 */
export default function Onboarding({
  state,
  isAdmin,
  fineManager,
  homeHref,
}: {
  state: OnboardingState | null
  isAdmin: boolean
  /** Finemaster title or superadmin: sees the fine-management What's new items */
  fineManager: boolean
  homeHref: string
}) {
  const viewer: WhatsNewViewer = useMemo(() => ({ isAdmin, fineManager }), [isAdmin, fineManager])
  const router = useRouter()
  const pathname = usePathname()
  const [touring, setTouring] = useState(false)
  // Tour due or asked for: it starts once Home has rendered
  const [tourPending, setTourPending] = useState(() => !!state && !state.tourDone)
  // The first, saved run (Profile replays aren't saved again)
  const [firstTour, setFirstTour] = useState(() => !!state && !state.tourDone)
  const [unseen] = useState<Release[]>(() => (state && !state.isNew ? unseenReleases(state.seenRelease, viewer) : []))
  const [releases, setReleases] = useState<Release[]>(() => (state?.tourDone ? unseen : []))
  const [seenSaved, setSeenSaved] = useState(false)

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
    const onWhatsNew = () => setReleases(allReleases(viewer))
    window.addEventListener(START_TOUR_EVENT, onTour)
    window.addEventListener(OPEN_WHATS_NEW_EVENT, onWhatsNew)
    return () => {
      window.removeEventListener(START_TOUR_EVENT, onTour)
      window.removeEventListener(OPEN_WHATS_NEW_EVENT, onWhatsNew)
    }
  }, [requestTour, viewer])

  if (!state) return null

  function closeWhatsNew() {
    setReleases([])
    if (unseen.length > 0 && !seenSaved) {
      setSeenSaved(true)
      save(() => unwrap(markWhatsNewSeen()))
    }
  }

  function endTour() {
    setTouring(false)
    window.scrollTo({ top: 0 })
    if (!firstTour) return
    setFirstTour(false)
    // A new account has nothing to catch up on; an existing one sees what's new next
    save(() => unwrap(finishTour(!!state?.isNew)))
    if (unseen.length > 0 && !seenSaved) setReleases(unseen)
  }

  return (
    <>
      {releases.length > 0 && !touring && <WhatsNew releases={releases} onClose={closeWhatsNew} />}
      {touring && <Tour steps={tourSteps(viewer.isAdmin)} onDone={endTour} />}
    </>
  )
}
