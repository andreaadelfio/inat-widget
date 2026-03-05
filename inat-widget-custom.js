/**
 * iNaturalist Observations Widget (customized)
 * Inspired by: https://glauberramos.github.io/inat/widget
 */
(function(){
  'use strict';

  const INAT_API = 'https://api.inaturalist.org/v1';
  const STYLESHEET_ID = 'inat-widget-custom-stylesheet';
  const MOBILE_BREAKPOINT = 760;

  function resolveStylesheetHref(){
    const script = document.currentScript
      || Array.from(document.scripts).reverse().find((node) => {
        return /inat-widget-custom\.js(?:\?|$)/.test(node?.src || '');
      });
    const src = script?.src || '';
    if(src){
      return src.replace(/inat-widget-custom\.js(?:\?.*)?$/, 'inat-widget-custom.css');
    }
    return 'inat-widget/inat-widget-custom.css';
  }

  function ensureStylesheet(){
    if(document.getElementById(STYLESHEET_ID)) return;
    const link = document.createElement('link');
    link.id = STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = resolveStylesheetHref();
    document.head.appendChild(link);
  }

  function initWidgets(){
    const containers = Array.from(document.querySelectorAll('[data-inat-widget]'));
    containers.forEach((el) => {
      new InatWidget(el);
    });
  }

  class InatWidget {
    constructor(container){
      this.container = container;
      this.source = this.readString('inatSource');
      this.sourceType = this.readEnum('inatSourceType', ['user', 'project', 'place', 'taxon', 'observation'], 'user');
      this.limit = this.readInt('inatLimit', 10, 1, 50);
      this.orderBy = this.readString('inatOrderBy') || 'observed_on';
      this.order = this.readEnum('inatOrder', ['asc', 'desc'], 'desc');
      this.layout = this.readEnum('inatLayout', ['grid', 'list', 'cards'], 'grid');
      this.theme = this.readEnum('inatTheme', ['light', 'dark', 'transparent-light', 'transparent-dark'], 'light');
      this.title = this.readString('inatTitle') || 'View my observations on';
      this.userIcon = this.readString('inatUserIcon');
      this.taxon = this.readString('inatTaxon');
      this.qualityGrade = this.readString('inatQuality') || this.readString('inatQualityGrade');
      this.dateFrom = this.readString('inatDateFrom');
      this.dateTo = this.readString('inatDateTo');
      this.dateOn = this.readString('inatDate');
      this.showTitle = this.readBool('inatShowTitle', true);
      this.showLocation = this.readBool('inatShowLocation', true);
      this.showGrade = this.readBool('inatShowGrade', false);
      this.showNotes = this.readBool('inatShowNotes', false);
      this.borderRadius = this.readInt('inatRadius', 12, 0, 50);
      this.padding = this.readInt('inatPadding', 16, 0, 50);
      this.photoSize = this.readEnum('inatPhotoSize', ['auto', 'square', 'small', 'medium', 'large'], 'auto');
      this.observations = [];
      this.viewportMql = this.createViewportMatcher();

      ensureStylesheet();
      this.renderShell();
      this.bindViewportListener();
      this.bindResizeListener();
      this.fetchObservations();
    }

    readString(name){
      return String(this.container.dataset[name] || '').trim();
    }

    readInt(name, fallback, min, max){
      const value = Number(this.container.dataset[name]);
      if(!Number.isFinite(value)) return fallback;
      return Math.min(max, Math.max(min, Math.floor(value)));
    }

    readBool(name, fallback){
      const value = this.container.dataset[name];
      if(value == null || value === '') return fallback;
      return !/^(false|0|no)$/i.test(String(value).trim());
    }

    readEnum(name, values, fallback){
      const value = this.readString(name).toLowerCase();
      return values.includes(value) ? value : fallback;
    }

    createViewportMatcher(){
      if(typeof window === 'undefined' || typeof window.matchMedia !== 'function'){
        return null;
      }
      return window.matchMedia(`(max-width:${MOBILE_BREAKPOINT}px)`);
    }

    bindViewportListener(){
      if(!this.viewportMql) return;
      this.onViewportChange = () => {
        if(!this.observations.length) return;
        if(this.layout === 'grid'){
          this.renderGrid();
          return;
        }
        if(this.layout === 'cards' && this.photoSize === 'auto'){
          this.renderCards();
        }
      };
      this.viewportMql.addEventListener('change', this.onViewportChange);
    }

    bindResizeListener(){
      if(typeof window === 'undefined' || typeof window.addEventListener !== 'function'){
        return;
      }
      this.onWindowResize = () => {
        if(!this.observations.length) return;
        if(this.layout !== 'grid' || !this.isCompactLayout()) return;
        this.applyCompactGridLayout();
      };
      window.addEventListener('resize', this.onWindowResize);
    }

    isCompactLayout(){
      return Boolean(this.viewportMql && this.viewportMql.matches);
    }

    resolvePhotoSize(desktopSize){
      if(this.photoSize && this.photoSize !== 'auto'){
        return this.photoSize;
      }
      return this.isCompactLayout() ? 'small' : desktopSize;
    }

    resolveGridSizing(){
      const sizeMap = {
        auto: { desktopMin: 150, mobileMin: 72, desktopGap: 8, mobileGap: 4 },
        square: { desktopMin: 84, mobileMin: 64, desktopGap: 4, mobileGap: 4 },
        small: { desktopMin: 102, mobileMin: 72, desktopGap: 6, mobileGap: 4 },
        medium: { desktopMin: 150, mobileMin: 118, desktopGap: 8, mobileGap: 8 },
        large: { desktopMin: 190, mobileMin: 136, desktopGap: 10, mobileGap: 8 }
      };
      return sizeMap[this.photoSize] || sizeMap.auto;
    }

    resolveCompactGridColumns(width, itemCount, minTile, gap){
      let maxCols = Math.floor((width + gap) / (minTile + gap));
      maxCols = Math.max(1, Math.min(maxCols, itemCount));
      let bestCols = maxCols;
      let bestScore = Number.POSITIVE_INFINITY;

      for(let cols = 1; cols <= maxCols; cols += 1){
        const rows = Math.ceil(itemCount / cols);
        const holes = (rows * cols) - itemCount;
        const compactPenalty = Math.pow(maxCols - cols, 2);
        const score = (holes * 10) + compactPenalty;
        if(score < bestScore){
          bestScore = score;
          bestCols = cols;
        }
      }
      return bestCols;
    }

    applyCompactGridLayout(){
      if(this.layout !== 'grid' || !this.isCompactLayout()) return;
      if(!this.gridEl) return;
      const itemCount = this.observations.length;
      if(itemCount <= 0) return;

      const width = this.gridEl.clientWidth || this.contentEl?.clientWidth || this.container.clientWidth || 0;
      if(width <= 0) return;

      const minTile = 64;
      const gap = 4;
      const cols = this.resolveCompactGridColumns(width, itemCount, minTile, gap);
      this.gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    }

    renderShell(){
      this.container.innerHTML = '';
      this.container.className = `inat-w inat-theme-${this.theme}`;
      this.container.style.setProperty('--inat-radius', `${this.borderRadius}px`);
      this.container.style.setProperty('--inat-radius-sm', `${Math.max(0, this.borderRadius - 3)}px`);
      this.container.style.padding = `${this.padding}px`;
      const gridSizing = this.resolveGridSizing();
      this.container.style.setProperty('--inat-grid-min', `${gridSizing.desktopMin}px`);
      this.container.style.setProperty('--inat-grid-gap', `${gridSizing.desktopGap}px`);
      this.container.style.setProperty('--inat-grid-min-mobile', `${gridSizing.mobileMin}px`);
      this.container.style.setProperty('--inat-grid-gap-mobile', `${gridSizing.mobileGap}px`);

      const header = document.createElement('div');
      header.className = 'inat-w-header';

      const sourceUrl = this.getHeaderSourceUrl();
      const userLabel = this.getHeaderUserLabel();

      const userLink = document.createElement('a');
      userLink.className = 'inat-w-user-link inat-w-source-link';
      userLink.href = sourceUrl;
      userLink.target = '_blank';
      userLink.rel = 'noopener noreferrer';
      userLink.setAttribute('aria-label', `Observations by ${userLabel}`);

      const userImg = document.createElement('img');
      userImg.className = 'inat-w-usericon';
      userImg.src = this.getHeaderUserIcon();
      userImg.alt = userLabel;
      userLink.appendChild(userImg);
      header.appendChild(userLink);

      const headerRight = document.createElement('div');
      headerRight.className = 'inat-w-header-right';

      if(this.showTitle){
        const titleLink = document.createElement('a');
        titleLink.className = 'inat-w-header-text inat-w-source-link';
        titleLink.href = sourceUrl;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.textContent = this.title || 'View my observations on';
        headerRight.appendChild(titleLink);
        this.headerSourceLinks = [userLink, titleLink];
      }else{
        this.headerSourceLinks = [userLink];
      }

      const logoLink = document.createElement('a');
      logoLink.className = 'inat-w-logo-link';
      logoLink.href = 'https://www.inaturalist.org';
      logoLink.target = '_blank';
      logoLink.rel = 'noopener noreferrer';
      logoLink.setAttribute('aria-label', 'iNaturalist');

      const logo = document.createElement('img');
      logo.className = 'inat-w-header-logo';
      logo.src = 'https://static.inaturalist.org/sites/1-logo.svg';
      logo.alt = 'iNaturalist';
      logoLink.appendChild(logo);
      headerRight.appendChild(logoLink);
      header.appendChild(headerRight);

      this.headerUserIconEl = userImg;
      this.headerUserLinkEl = userLink;

      this.container.appendChild(header);

      this.contentEl = document.createElement('div');
      this.contentEl.innerHTML = '<div class="inat-w-loading"><div class="inat-w-spinner"></div><span>Loading observations...</span></div>';
      this.container.appendChild(this.contentEl);
    }

    getSourceParamName(){
      if(this.sourceType === 'project') return 'project_id';
      if(this.sourceType === 'place') return 'place_id';
      if(this.sourceType === 'taxon') return 'taxon_id';
      return 'user_login';
    }

    getSourceUrl(){
      if(this.sourceType === 'observation'){
        return `https://www.inaturalist.org/observations/${encodeURIComponent(this.normalizeObservationSource(this.source))}`;
      }
      if(this.sourceType === 'project'){
        return `https://www.inaturalist.org/projects/${encodeURIComponent(this.source)}?tab=observations`;
      }
      if(this.sourceType === 'place'){
        return `https://www.inaturalist.org/observations?place_id=${encodeURIComponent(this.source)}`;
      }
      if(this.sourceType === 'taxon'){
        return `https://www.inaturalist.org/taxa/${encodeURIComponent(this.source)}`;
      }
      return `https://www.inaturalist.org/observations/${encodeURIComponent(this.source)}`;
    }

    getHeaderSourceUrl(){
      if(this.sourceType === 'user' && this.source){
        return `https://www.inaturalist.org/observations/${encodeURIComponent(this.source)}`;
      }
      return this.getSourceUrl();
    }

    getHeaderUserLabel(){
      if(this.sourceType === 'user' && this.source){
        return this.source;
      }
      return 'iNaturalist user';
    }

    getHeaderUserIcon(){
      if(this.userIcon){
        return this.userIcon;
      }
      if(this.sourceType === 'user' && this.source.toLowerCase() === 'andreaadelfio'){
        return 'https://static.inaturalist.org/attachments/users/icons/3032137/thumb.jpeg';
      }
      return this.getFallbackUserIcon();
    }

    getFallbackUserIcon(){
      const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23dbe3ea'/><text x='32' y='38' text-anchor='middle' font-family='Arial,sans-serif' font-size='20' fill='%235b6775'>iN</text></svg>";
      return `data:image/svg+xml;utf8,${svg}`;
    }

    syncHeaderFromObservation(){
      const first = this.observations[0];
      if(!first) return;

      const login = String(first?.user?.login || '').trim();
      const displayName = String(first?.user?.name || login || this.getHeaderUserLabel()).trim();
      const icon = String(first?.user?.icon || '').trim();

      if(login && Array.isArray(this.headerSourceLinks)){
        const url = `https://www.inaturalist.org/observations/${encodeURIComponent(login)}`;
        this.headerSourceLinks.forEach((link) => {
          link.href = url;
        });
      }

      if(this.headerUserLinkEl){
        this.headerUserLinkEl.setAttribute('aria-label', `Observations by ${displayName}`);
      }

      if(this.headerUserIconEl){
        this.headerUserIconEl.alt = displayName;
        if(icon){
          this.headerUserIconEl.src = icon;
        }
      }
    }

    normalizeObservationSource(value){
      const source = String(value || '').trim();
      const match = source.match(/observations\/(\d+)/);
      return match ? match[1] : source;
    }

    async fetchObservations(){
      if(!this.source){
        this.renderError('Missing source value.');
        return;
      }

      try{
        if(this.sourceType === 'observation'){
          const id = this.normalizeObservationSource(this.source);
          const response = await fetch(`${INAT_API}/observations/${encodeURIComponent(id)}`);
          if(!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          this.observations = Array.isArray(data?.results) ? data.results : [];
          if(!this.observations.length){
            this.renderError('Observation not found.');
            return;
          }
          this.syncHeaderFromObservation();
          this.renderObservations();
          return;
        }

        const params = new URLSearchParams();
        params.set('per_page', String(this.limit));
        params.set('order', this.order);
        params.set('order_by', this.orderBy);
        params.set(this.getSourceParamName(), this.source);

        if(this.taxon && this.sourceType !== 'taxon'){
          params.set('taxon_id', this.taxon);
        }
        if(this.qualityGrade && this.qualityGrade !== 'any'){
          params.set('quality_grade', this.qualityGrade);
        }
        if(this.dateOn){
          params.set('on', this.dateOn);
        }else{
          if(this.dateFrom) params.set('d1', this.dateFrom);
          if(this.dateTo) params.set('d2', this.dateTo);
        }

        const response = await fetch(`${INAT_API}/observations?${params.toString()}`);
        if(!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        this.observations = Array.isArray(data?.results) ? data.results : [];
        if(!this.observations.length){
          this.renderError('No observations found for this source.');
          return;
        }

        this.syncHeaderFromObservation();
        this.renderObservations();
      }catch(error){
        console.error('iNaturalist widget load error:', error);
        this.renderError('Could not load observations right now.');
      }
    }

    renderError(message){
      this.contentEl.innerHTML = `<div class="inat-w-error">${this.escapeHtml(message)}</div>`;
    }

    renderObservations(){
      if(this.layout === 'list'){
        this.renderList();
        return;
      }
      if(this.layout === 'cards'){
        this.renderCards();
        return;
      }
      this.renderGrid();
    }

    renderGrid(){
      const wrap = document.createElement('div');
      const compactMode = this.isCompactLayout();
      wrap.className = `inat-w-grid${compactMode ? ' inat-w-compact' : ''}`;

      this.observations.forEach((obs) => {
        const item = document.createElement('a');
        item.className = 'inat-w-grid-item';
        item.href = this.getObservationUrl(obs);
        item.target = '_blank';
        item.rel = 'noopener noreferrer';

        const photo = this.getPhotoUrl(
          obs,
          compactMode ? 'square' : this.resolvePhotoSize('medium')
        );
        if(photo){
          const image = document.createElement('img');
          image.className = 'inat-w-grid-img';
          image.src = photo;
          image.alt = this.getCommonName(obs);
          image.loading = 'lazy';
          item.appendChild(image);
        }else{
          const fallback = document.createElement('div');
          fallback.className = 'inat-w-no-photo';
          fallback.textContent = this.noPhotoLabel(obs);
          item.appendChild(fallback);
        }

        if(!compactMode){
          const overlay = document.createElement('div');
          overlay.className = 'inat-w-grid-overlay';

          const name = document.createElement('div');
          name.className = 'inat-w-grid-name';
          name.textContent = this.getCommonName(obs);
          overlay.appendChild(name);

          const sci = this.getScientificName(obs);
          if(sci){
            const sciLine = document.createElement('div');
            sciLine.className = 'inat-w-grid-sci';
            sciLine.textContent = sci;
            overlay.appendChild(sciLine);
          }

          item.appendChild(overlay);
        }

        wrap.appendChild(item);
      });

      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(wrap);
      this.gridEl = wrap;
      this.applyCompactGridLayout();
      if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
        window.requestAnimationFrame(() => this.applyCompactGridLayout());
      }
    }

    renderList(){
      const wrap = document.createElement('div');
      wrap.className = 'inat-w-list';

      this.observations.forEach((obs) => {
        const item = document.createElement('a');
        item.className = 'inat-w-list-item';
        item.href = this.getObservationUrl(obs);
        item.target = '_blank';
        item.rel = 'noopener noreferrer';

        const photo = this.getPhotoUrl(obs, 'square');
        if(photo){
          const image = document.createElement('img');
          image.className = 'inat-w-list-img';
          image.src = photo;
          image.alt = this.getCommonName(obs);
          image.loading = 'lazy';
          item.appendChild(image);
        }else{
          const fallback = document.createElement('div');
          fallback.className = 'inat-w-list-img inat-w-no-photo';
          fallback.textContent = this.noPhotoLabel(obs);
          item.appendChild(fallback);
        }

        const info = document.createElement('div');
        info.className = 'inat-w-list-info';

        const name = document.createElement('div');
        name.className = 'inat-w-list-name';
        name.textContent = this.getCommonName(obs);
        info.appendChild(name);

        const sci = this.getScientificName(obs);
        if(sci){
          const sciLine = document.createElement('div');
          sciLine.className = 'inat-w-list-scientific';
          sciLine.textContent = sci;
          info.appendChild(sciLine);
        }

        const meta = document.createElement('div');
        meta.className = 'inat-w-list-meta';
        meta.textContent = `${obs?.user?.login || ''} · ${this.formatDate(obs)}`;
        info.appendChild(meta);

        item.appendChild(info);

        if(this.showGrade && obs.quality_grade && obs.quality_grade !== 'casual'){
          const grade = document.createElement('span');
          grade.className = `inat-w-grade inat-w-grade-${obs.quality_grade}`;
          grade.textContent = obs.quality_grade === 'research' ? 'RG' : 'Needs ID';
          item.appendChild(grade);
        }

        wrap.appendChild(item);
      });

      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(wrap);
    }

    renderCards(){
      const wrap = document.createElement('div');
      wrap.className = 'inat-w-cards';

      this.observations.forEach((obs) => {
        const card = document.createElement('a');
        card.className = 'inat-w-card';
        card.href = this.getObservationUrl(obs);
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        const cover = document.createElement('div');
        cover.className = 'inat-w-card-cover';
        const photo = this.getPhotoUrl(obs, this.resolvePhotoSize('medium'));
        if(photo){
          const image = document.createElement('img');
          image.className = 'inat-w-card-cover-img';
          image.src = photo;
          image.alt = this.getCommonName(obs);
          image.loading = 'lazy';
          cover.appendChild(image);
        }else{
          const fallback = document.createElement('div');
          fallback.className = 'inat-w-no-photo';
          fallback.textContent = this.noPhotoLabel(obs);
          cover.appendChild(fallback);
        }
        card.appendChild(cover);

        const body = document.createElement('div');
        body.className = 'inat-w-card-body';

        const common = document.createElement('div');
        common.className = 'inat-w-card-common';
        common.textContent = this.getCommonName(obs);
        body.appendChild(common);

        const sci = this.getScientificName(obs);
        if(sci){
          const sciLine = document.createElement('div');
          sciLine.className = 'inat-w-card-scientific';
          sciLine.textContent = sci;
          body.appendChild(sciLine);
        }

        const details = document.createElement('div');
        details.className = 'inat-w-card-details';
        details.appendChild(this.buildDetailRow('Observer:', obs?.user?.login || 'Unknown'));
        details.appendChild(this.buildDetailRow('Date:', this.formatDate(obs)));

        if(this.showLocation){
          details.appendChild(this.buildDetailRow('Location:', obs.place_guess || 'Unknown'));
        }

        if(this.showGrade && obs.quality_grade && obs.quality_grade !== 'casual'){
          details.appendChild(this.buildDetailRow('Grade:', obs.quality_grade === 'research' ? 'Research Grade' : 'Needs ID'));
        }

        if(this.showNotes && obs.description){
          details.appendChild(this.buildDetailRow('Notes:', obs.description));
        }

        body.appendChild(details);
        card.appendChild(body);
        wrap.appendChild(card);
      });

      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(wrap);
    }

    buildDetailRow(label, value){
      const row = document.createElement('div');
      row.className = 'inat-w-card-detail';

      const labelEl = document.createElement('span');
      labelEl.className = 'inat-w-card-detail-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'inat-w-card-detail-value';
      valueEl.textContent = String(value || '');

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      return row;
    }

    getObservationUrl(obs){
      if(obs?.uri) return obs.uri;
      if(obs?.id) return `https://www.inaturalist.org/observations/${obs.id}`;
      return 'https://www.inaturalist.org/observations';
    }

    getCommonName(obs){
      return obs?.taxon?.preferred_common_name
        || obs?.species_guess
        || obs?.taxon?.name
        || 'Unknown species';
    }

    getScientificName(obs){
      return obs?.taxon?.name || '';
    }

    getPhotoUrl(obs, size){
      const url = obs?.photos?.[0]?.url || '';
      if(!url) return '';
      return url.replace(/(square|small|medium|large)/, size);
    }

    noPhotoLabel(obs){
      const hasAudio = Array.isArray(obs?.sounds) && obs.sounds.length > 0;
      return hasAudio ? 'Audio' : 'Photo';
    }

    formatDate(obs){
      const dateStr = obs?.observed_on || obs?.created_at || '';
      if(!dateStr) return 'Unknown date';
      const date = new Date(dateStr);
      if(Number.isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    escapeHtml(value){
      if(!value) return '';
      const div = document.createElement('div');
      div.textContent = String(value);
      return div.innerHTML;
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initWidgets);
  }else{
    initWidgets();
  }

  window.InatWidget = InatWidget;
  window.initInatWidgets = initWidgets;
})();
