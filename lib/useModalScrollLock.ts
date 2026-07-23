'use client'

import { useEffect } from 'react'

type LockedStyles = {
  htmlOverflow: string
  htmlOverscrollBehavior: string
  htmlModalOpen: string | undefined
  bodyOverflow: string
  bodyOverscrollBehavior: string
}

let activeLocks = 0
let previousStyles: LockedStyles | null = null

function lockPageScroll() {
  if (activeLocks === 0) {
    previousStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
      htmlModalOpen: document.documentElement.dataset.modalOpen,
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    }

    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'
    document.documentElement.dataset.modalOpen = 'true'
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
  }

  activeLocks += 1
}

function unlockPageScroll() {
  activeLocks = Math.max(0, activeLocks - 1)
  if (activeLocks !== 0 || !previousStyles) return

  document.documentElement.style.overflow = previousStyles.htmlOverflow
  document.documentElement.style.overscrollBehavior = previousStyles.htmlOverscrollBehavior
  if (previousStyles.htmlModalOpen === undefined) {
    delete document.documentElement.dataset.modalOpen
  } else {
    document.documentElement.dataset.modalOpen = previousStyles.htmlModalOpen
  }
  document.body.style.overflow = previousStyles.bodyOverflow
  document.body.style.overscrollBehavior = previousStyles.bodyOverscrollBehavior
  previousStyles = null
}

/** Prevent background scrolling and pull-to-refresh while a modal is open. */
export function useModalScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) return

    lockPageScroll()
    return unlockPageScroll
  }, [isLocked])
}
