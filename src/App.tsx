import { useState } from "react";
import ToolsPage from "./features/tools/ToolsPage";
import EncyclopediaPage from "./features/encyclopedia/EncyclopediaPage";
import CampaignsPage from "./features/campaigns/CampaignsPage";

const destinations = [
  {
    id: "campagnes",
    number: "01",
    title: "Campagnes",
    description: "Retrouvez vos aventures, vos séances et vos notes.",
    icon: "✧",
  },
  {
    id: "encyclopedie",
    number: "02",
    title: "Encyclopédie",
    description: "Créatures, objets, sorts et lieux à portée de main.",
    icon: "⌕",
  },
  {
    id: "personnages",
    number: "03",
    title: "Personnages",
    description: "Gardez vos héros et leurs fiches toujours avec vous.",
    icon: "♙",
  },
  {
    id: "outils",
    number: "04",
    title: "Outils de jeu",
    description: "Préparez vos rencontres et lancez les dés.",
    icon: "⚄",
  },
];

function App() {
  const [page, setPage] = useState<
    "home" | "campaigns" | "encyclopedia" | "tools"
  >("home");
  const [campaignSelectionReset, setCampaignSelectionReset] = useState(0);

  function openCampaigns() {
    setPage("campaigns");
    setCampaignSelectionReset((current) => current + 1);
  }

  function openEncyclopedia() {
    setPage("encyclopedia");
  }

  function openTools() {
    setPage("tools");
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#accueil"
          aria-label="Le Grimoire, accueil"
          onClick={() => setPage("home")}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 3.5 35 12v16L20 36.5 5 28V12L20 3.5Z" />
              <path d="m20 9 9 5.2v10.6L20 30l-9-5.2V14.2L20 9Z" />
              <path d="m20 9 0 21m-9-15.8 18 10.6m0-10.6L11 24.8" />
            </svg>
          </span>
          <span className="brand-name">Le Grimoire</span>
        </a>

        <nav className="main-nav" aria-label="Navigation principale">
          <a
            className={`nav-link${page === "campaigns" ? " nav-link-active" : ""}`}
            href="#campagnes"
            aria-current={page === "campaigns" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openCampaigns();
            }}
          >
            Campagnes
          </a>
          <a
            className={`nav-link${page === "encyclopedia" ? " nav-link-active" : ""}`}
            href="#encyclopedie"
            aria-current={page === "encyclopedia" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openEncyclopedia();
            }}
          >
            Encyclopédie
          </a>
          <a className="nav-link" href="#personnages">
            Personnages
          </a>
          <a
            className={`nav-link${page === "tools" ? " nav-link-active" : ""}`}
            href="#outils"
            aria-current={page === "tools" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              openTools();
            }}
          >
            Outils
          </a>
        </nav>

        <a className="account-link" href="#mon-compte">
          <span className="account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20c.45-3.1 2.95-5.25 6.5-5.25s6.05 2.15 6.5 5.25" />
            </svg>
          </span>
          <span>Mon compte</span>
        </a>
      </header>

      <main>
        <CampaignsPage
          hidden={page !== "campaigns"}
          selectionReset={campaignSelectionReset}
        />
        {page === "encyclopedia" ? (
          <EncyclopediaPage />
        ) : page === "tools" ? (
          <ToolsPage />
        ) : page === "home" ? (
          <>
            <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" />
              Votre compagnon de campagne
            </p>
            <h1 id="hero-title">
              Les grandes aventures commencent <em>ici.</em>
            </h1>
            <p className="hero-description">
              Campagnes, personnages et savoirs oubliés : tout votre univers de
              jeu réuni dans un seul grimoire.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href="#campagnes"
                onClick={(event) => {
                  event.preventDefault();
                  openCampaigns();
                }}
              >
                Découvrir mes campagnes
                <span aria-hidden="true">↗</span>
              </a>
              <a
                className="text-link"
                href="#encyclopedie"
                onClick={(event) => {
                  event.preventDefault();
                  openEncyclopedia();
                }}
              >
                Parcourir l’encyclopédie
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hero-note">
              <span className="note-star" aria-hidden="true">
                ✳
              </span>
              <span>Pensé pour les maîtres du jeu et leurs aventuriers</span>
            </div>
          </div>

          <div className="hero-art" aria-label="Illustration décorative d'un dé à vingt faces">
            <div className="art-glow" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-spark spark-one">✦</div>
            <div className="art-spark spark-two">✧</div>
            <div className="die">
              <svg viewBox="0 0 320 340" role="img" aria-label="Dé à vingt faces">
                <defs>
                  <linearGradient id="d20-shell" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#50664a" />
                    <stop offset="0.5" stopColor="#263f33" />
                    <stop offset="1" stopColor="#182e28" />
                  </linearGradient>
                  <linearGradient id="d20-center" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#70805b" />
                    <stop offset="1" stopColor="#364f3d" />
                  </linearGradient>
                  <linearGradient id="d20-bottom" x1="0" y1="0" x2="0.9" y2="1">
                    <stop offset="0" stopColor="#405b43" />
                    <stop offset="1" stopColor="#20382f" />
                  </linearGradient>
                </defs>
                <path
                  className="die-outline"
                  d="m160 14 81 46 45 79-17 87-55 63-54 37-54-37-55-63-17-87 45-79 81-46Z"
                />
                <path className="die-facet die-facet-left-top" d="m160 14-81 46-45 79 126 22Z" />
                <path className="die-facet die-facet-left-mid" d="m160 14-126 125 17 87 109-7Z" />
                <path className="die-facet die-facet-right-top" d="m160 14 81 46 45 79-126 22Z" />
                <path className="die-facet die-facet-right-mid" d="m160 14 126 125-17 87-109-7Z" />
                <path className="die-facet die-facet-left-low" d="m34 139 17 87 55 63 54-70Z" />
                <path className="die-facet die-facet-left-bottom" d="m51 226 55 63 54 37v-107Z" />
                <path className="die-facet die-facet-right-low" d="m286 139-17 87-55 63-54-70Z" />
                <path className="die-facet die-facet-right-bottom" d="m269 226-55 63-54 37v-107Z" />
                <path className="die-facet die-face-main" d="m160 14-109 212h218Z" />
                <path className="die-facet die-face-bottom" d="m51 226 109 100 109-100Z" />
                <text className="die-number die-number-main" x="160" y="167" textAnchor="middle">
                  ✦
                </text>
              </svg>
            </div>
            <div className="art-caption">
              <span className="caption-rule" />
              <span>À vous d’écrire la suite</span>
            </div>
          </div>
        </section>

            <section className="destinations" aria-labelledby="destinations-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-eyebrow">Votre table de jeu</p>
              <h2 id="destinations-title">Tout commence par un choix.</h2>
            </div>
            <p className="section-aside">
              Le nécessaire pour préparer, jouer et faire vivre vos aventures.
            </p>
          </div>

          <div className="destination-grid">
            {destinations.map((destination) => (
              <a
                className="destination-card"
                href={`#${destination.id}`}
                id={destination.id}
                key={destination.id}
                onClick={
                  destination.id === "campagnes"
                    ? (event) => {
                        event.preventDefault();
                        openCampaigns();
                      }
                    : destination.id === "encyclopedie"
                      ? (event) => {
                          event.preventDefault();
                          openEncyclopedia();
                        }
                    : destination.id === "outils"
                      ? (event) => {
                          event.preventDefault();
                          openTools();
                        }
                    : undefined
                }
              >
                <div className="card-topline">
                  <span className="card-number">{destination.number}</span>
                  <span className="card-icon" aria-hidden="true">
                    {destination.icon}
                  </span>
                </div>
                <h3>{destination.title}</h3>
                <p>{destination.description}</p>
                <span className="card-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </section>

            <section className="account-callout" id="mon-compte">
          <div className="callout-seal" aria-hidden="true">
            ✦
          </div>
          <div>
            <p className="eyebrow">Votre espace</p>
            <h2>Une place à votre table.</h2>
            <p>Retrouvez bientôt ici vos campagnes et vos personnages.</p>
          </div>
          <span className="callout-note">Le Grimoire prend forme</span>
            </section>

          </>
        ) : null}
      </main>

      <footer className="site-footer">
        <a
          className="footer-brand"
          href="#accueil"
          onClick={() => setPage("home")}
        >
          Le Grimoire
        </a>
        <span>Herebos - DCO 2026</span>
        <span>Un compagnon pour vos aventures, quelle que soit votre table.</span>
        <span className="footer-edition">Édition 2014 · 5e</span>
      </footer>

    </div>
  );
}

export default App;
