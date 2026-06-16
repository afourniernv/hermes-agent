/**
 * Cmd-K "Pets…" page — browse the petdex gallery, adopt/switch, toggle off.
 *
 * A thin view over the `pet-gallery` store: it subscribes to the shared atoms
 * and calls the store's actions. The store owns fetching, caching, the thumb
 * cache, and optimistic mutations, so reopening this page is instant and a
 * toggle never re-pulls the network gallery.
 */

import { useStore } from '@nanostores/react'
import { useEffect, useMemo } from 'react'

import { HUD_ITEM, HUD_TEXT } from '@/app/floating-hud'
import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'
import { PetThumb } from '@/components/pet/pet-thumb'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, Loader2, PawPrint, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  $petBusy,
  $petGallery,
  $petGalleryError,
  $petGalleryStatus,
  adoptPet,
  loadPetGallery,
  loadPetThumb,
  rankedGalleryPets,
  setPetEnabled,
  TOGGLE_OFF,
  TOGGLE_ON
} from '@/store/pet-gallery'

interface PetPalettePageProps {
  search: string
}

export function PetPalettePage({ search }: PetPalettePageProps) {
  const { t } = useI18n()
  const copy = t.commandCenter.pets
  const { requestGateway } = useGatewayRequest()

  const gallery = useStore($petGallery)
  const status = useStore($petGalleryStatus)
  const error = useStore($petGalleryError)
  const busy = useStore($petBusy)

  useEffect(() => {
    void loadPetGallery(requestGateway)
  }, [requestGateway])

  const enabled = gallery?.enabled ?? false
  const active = gallery?.active ?? ''

  const shown = useMemo(() => rankedGalleryPets(gallery, search).slice(0, 50), [gallery, search])

  const adopt = (slug: string) => {
    void adoptPet(requestGateway, slug, copy.adoptFailed).then(ok => ok && triggerHaptic('crisp'))
  }

  const toggle = (on: boolean) => {
    void setPetEnabled(requestGateway, on, { noneAvailable: copy.noneAvailable, fallback: copy.toggleFailed }).then(
      ok => ok && triggerHaptic('crisp')
    )
  }

  if (status === 'loading' && !gallery) {
    return <Status icon={<Loader2 className="size-3.5 animate-spin" />} text={copy.loading} />
  }

  if (status === 'stale') {
    return <Status text={copy.staleBackend} tone="error" />
  }

  if (!gallery?.pets.length && error) {
    return <Status text={error} tone="error" />
  }

  const mutating = Boolean(busy)

  return (
    <div role="listbox">
      <div className="flex gap-1 border-b border-border/60 px-2 py-1.5">
        <ToggleButton
          active={!enabled}
          busy={busy === TOGGLE_OFF}
          disabled={mutating}
          icon={X}
          label={copy.turnOff}
          onClick={() => toggle(false)}
        />
        <ToggleButton
          active={enabled}
          busy={busy === TOGGLE_ON}
          disabled={mutating}
          icon={PawPrint}
          label={copy.turnOn}
          onClick={() => toggle(true)}
        />
      </div>

      {error && <p className="px-2 pb-1 pt-1.5 text-[0.6875rem] text-(--ui-red)">{error}</p>}

      {shown.length === 0 ? (
        <Status text={copy.empty} />
      ) : (
        shown.map(pet => {
          const isActive = enabled && pet.slug === active
          const isBusy = busy === pet.slug

          return (
            <button
              className={cn(
                'flex w-full items-center gap-2 rounded-md text-left transition-colors hover:bg-(--chrome-action-hover) disabled:opacity-60',
                HUD_ITEM,
                HUD_TEXT,
                isActive && 'bg-(--chrome-action-hover)/70'
              )}
              disabled={mutating && !isBusy}
              key={pet.slug}
              onClick={() => adopt(pet.slug)}
              onMouseDown={event => event.preventDefault()}
              role="option"
              type="button"
            >
              <PetThumb
                alt={pet.displayName}
                load={(slug, url) => loadPetThumb(requestGateway, slug, url)}
                size={32}
                slug={pet.slug}
                url={pet.spritesheetUrl}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{pet.displayName}</span>
                <span className="truncate text-[0.6875rem] text-muted-foreground/80">
                  {pet.slug}
                  {pet.installed ? ` · ${copy.installed}` : ''}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.6875rem] text-muted-foreground">
                {isBusy ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    {copy.adopting}
                  </>
                ) : isActive ? (
                  <>
                    <Check className="size-3 text-(--ui-green)" />
                    {copy.active}
                  </>
                ) : null}
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}

function ToggleButton({
  active,
  busy,
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean
  busy: boolean
  disabled: boolean
  icon: typeof X
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.6875rem] font-medium transition-colors disabled:opacity-50',
        active ? 'bg-(--chrome-action-hover) text-foreground' : 'text-muted-foreground hover:bg-(--chrome-action-hover)/60'
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3.5" />}
      {label}
    </button>
  )
}

function Status({ icon, text, tone }: { icon?: React.ReactNode; text: string; tone?: 'error' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-2 py-6 text-xs',
        tone === 'error' ? 'text-(--ui-red)' : 'text-muted-foreground'
      )}
    >
      {icon}
      {text}
    </div>
  )
}
