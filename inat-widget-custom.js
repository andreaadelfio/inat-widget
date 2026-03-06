/**
 * iNaturalist Widget
 * Single responsive mode:
 * - wider screen: larger tiles, fewer columns
 * - narrower screen: smaller tiles, more columns
 */
(function(){
  'use strict';

  const INAT_API = 'https://api.inaturalist.org/v1';
  const STYLESHEET_ID = 'inat-widget-custom-stylesheet';

  function resolveStylesheetHref(){
    const script = document.currentScript
      || Array.from(document.scripts).reverse().find((node) => {
        return /inat-widget-custom\.js(?:\?|$)/.test(node?.src || '');
      });
    const src = script?.src || '';
    if(src){
      const match = src.match(/^(.*\/)inat-widget-custom\.js(\?.*)?$/);
      if(match){
        const base = match[1] || '';
        const query = match[2] || '';
        return `${base}inat-widget-custom.css${query}`;
      }
      return src.replace(/inat-widget-custom\.js$/, 'inat-widget-custom.css');
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
    containers.forEach((el) => new InatWidget(el));
  }

  class InatWidget {
    constructor(container){
      this.container = container;

      this.source = this.readString('inatSource');
      this.sourceType = this.readEnum('inatSourceType', ['user', 'project', 'place', 'taxon', 'observation'], 'user');
      this.theme = this.readEnum('inatTheme', ['light', 'dark', 'transparent-light', 'transparent-dark'], 'light');
      this.photoSize = this.readPhotoSize();

      this.limit = this.readInt('inatLimit', 10, 1, 50);
      this.orderBy = this.readString('inatOrderBy') || 'observed_on';
      this.order = this.readEnum('inatOrder', ['asc', 'desc'], 'desc');

      this.title = this.readString('inatTitle') || 'View my observations on';
      this.userIcon = this.readString('inatUserIcon');
      this.showTitle = this.readBool('inatShowTitle', true);

      this.padding = this.readInt('inatPadding', 14, 0, 50);
      this.borderRadius = this.readInt('inatRadius', 14, 0, 50);

      this.taxon = this.readString('inatTaxon');
      this.qualityGrade = this.readString('inatQuality') || this.readString('inatQualityGrade');
      this.dateFrom = this.readString('inatDateFrom');
      this.dateTo = this.readString('inatDateTo');
      this.dateOn = this.readString('inatDate');

      this.observations = [];

      ensureStylesheet();
      this.renderShell();
      this.bindViewportHandlers();
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

    readPhotoSize(){
      const raw = this.readString('inatPhotoSize').toLowerCase().replace(/\s+/g, '-');
      const aliases = {
        xs: 'extra-small',
        xsmall: 'extra-small',
        extrasmall: 'extra-small'
      };
      const normalized = aliases[raw] || raw;
      const allowed = ['auto', 'extra-small', 'square', 'small', 'medium', 'large'];
      return allowed.includes(normalized) ? normalized : 'auto';
    }

    bindViewportHandlers(){
      if(typeof window === 'undefined' || typeof window.addEventListener !== 'function'){
        return;
      }

      this.onResize = () => {
        if(!this.gridEl || !this.observations.length) return;
        this.applyGridMetrics();
      };

      window.addEventListener('resize', this.onResize);
    }

    getGridWidth(){
      return this.gridEl?.clientWidth
        || this.contentEl?.clientWidth
        || this.container.clientWidth
        || (typeof window !== 'undefined' ? window.innerWidth : 0);
    }

    getLayoutPhotoSize(width){
      if(this.photoSize !== 'auto'){
        return this.photoSize;
      }

      if(width <= 420) return 'square';
      if(width <= 760) return 'small';
      if(width <= 1200) return 'medium';
      return 'large';
    }

    getGridMetrics(width){
      const size = this.getLayoutPhotoSize(width);

      const baseColsByWidth = (
        width <= 420 ? 6 :
        width <= 560 ? 6 :
        width <= 760 ? 5 :
        width <= 980 ? 4 :
        width <= 1320 ? 3 :
        3
      );

      const colAdjustmentBySize = {
        'extra-small': 2,
        square: 1,
        small: 0,
        medium: 0,
        large: -1,
        auto: 0
      };

      const minTileAdjustmentBySize = {
        'extra-small': -20,
        square: 0,
        small: 0,
        medium: 0,
        large: 0,
        auto: 0
      };

      const gapAdjustmentBySize = {
        'extra-small': -2,
        square: 0,
        small: 0,
        medium: 0,
        large: 0,
        auto: 0
      };

      const maxColsBySize = {
        'extra-small': 10,
        square: 8,
        small: 8,
        medium: 8,
        large: 8,
        auto: 8
      };

      const minTileByWidth = (
        width <= 420 ? 44 :
        width <= 560 ? 52 :
        width <= 760 ? 60 :
        width <= 980 ? 74 :
        width <= 1320 ? 96 :
        108
      );

      const gapByWidth = (
        width <= 420 ? 3 :
        width <= 760 ? 4 :
        width <= 980 ? 5 :
        6
      );

      const minTile = Math.max(30, minTileByWidth + (minTileAdjustmentBySize[size] || 0));
      const gap = Math.max(2, gapByWidth + (gapAdjustmentBySize[size] || 0));
      const targetCols = Math.max(
        2,
        Math.min(maxColsBySize[size] || 8, baseColsByWidth + (colAdjustmentBySize[size] || 0))
      );

      return {
        gap,
        minTile,
        targetCols
      };
    }

    applyGridMetrics(){
      if(!this.gridEl) return;

      const width = this.getGridWidth();
      if(width <= 0) return;

      const itemCount = this.observations.length;
      if(itemCount <= 0) return;

      const metrics = this.getGridMetrics(width);
      const maxColsByMinTile = Math.max(1, Math.floor((width + metrics.gap) / (metrics.minTile + metrics.gap)));
      const cols = Math.max(1, Math.min(itemCount, Math.min(metrics.targetCols, maxColsByMinTile)));

      this.gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      this.gridEl.style.gap = `${metrics.gap}px`;
    }

    renderShell(){
      this.container.innerHTML = '';
      this.container.className = `inat-w inat-theme-${this.theme}`;
      this.container.style.setProperty('--inat-radius', `${this.borderRadius}px`);
      this.container.style.setProperty('--inat-radius-sm', `${Math.max(0, this.borderRadius - 3)}px`);
      this.container.style.padding = `${this.padding}px`;

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
      this.userImgEl = userImg;
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
        titleLink.textContent = this.title;
        headerRight.appendChild(titleLink);
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
      if(this.userIcon) return this.userIcon;
      return this.getFallbackUserIcon();
    }

    normalizeExternalUrl(value){
      const raw = String(value || '').trim();
      if(!raw) return '';
      if(raw.startsWith('//')) return `https:${raw}`;
      if(raw.startsWith('/')) return `https://www.inaturalist.org${raw}`;
      if(/^https?:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, 'https://');
      return raw;
    }

    getObservationUserIcon(obs){
      const candidates = [
        obs?.user?.icon_url,
        obs?.user?.icon,
        obs?.user?.user_icon_url
      ];
      for(const candidate of candidates){
        const normalized = this.normalizeExternalUrl(candidate);
        if(normalized) return normalized;
      }
      return '';
    }

    applyResolvedUserIcon(){
      if(this.userIcon) return;
      const iconFromData = this.observations
        .map((obs) => this.getObservationUserIcon(obs))
        .find(Boolean);
      if(!iconFromData) return;
      this.userIcon = iconFromData;
      if(this.userImgEl){
        this.userImgEl.src = iconFromData;
      }
    }

    async fetchUserIconFromApi(){
      if(this.userIcon || this.sourceType !== 'user' || !this.source) return;
      try{
        const response = await fetch(`${INAT_API}/users/${encodeURIComponent(this.source)}`);
        if(!response.ok) return;
        const data = await response.json();
        const user = Array.isArray(data?.results) ? data.results[0] : null;
        const icon = this.normalizeExternalUrl(user?.icon_url || user?.icon || user?.user_icon_url);
        if(!icon) return;
        this.userIcon = icon;
        if(this.userImgEl){
          this.userImgEl.src = icon;
        }
      }catch(error){
        console.warn('Could not resolve iNaturalist user icon:', error);
      }
    }

    getFallbackUserIcon(){
      const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='%23dbe3ea'/><text x='32' y='38' text-anchor='middle' font-family='Arial,sans-serif' font-size='20' fill='%235b6775'>iN</text></svg>";
      return `data:image/svg+xml;utf8,${svg}`;
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
        }else{
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
        }

        if(!this.observations.length){
          this.renderError('No observations found for this source.');
          return;
        }

        this.applyResolvedUserIcon();
        await this.fetchUserIconFromApi();
        this.renderGrid();
      }catch(error){
        console.error('iNaturalist widget load error:', error);
        this.renderError('Could not load observations right now.');
      }
    }

    renderError(message){
      this.contentEl.innerHTML = `<div class="inat-w-error">${this.escapeHtml(message)}</div>`;
    }

    renderGrid(){
      const wrap = document.createElement('div');
      wrap.className = 'inat-w-grid';

      const gridWidth = this.contentEl?.clientWidth
        || this.container.clientWidth
        || (typeof window !== 'undefined' ? window.innerWidth : 0);
      const photoSize = this.getLayoutPhotoSize(gridWidth);
      const photoAssetSize = this.getPhotoAssetSize(photoSize);

      this.observations.forEach((obs) => {
        const item = document.createElement('a');
        item.className = 'inat-w-grid-item';
        item.href = this.getObservationUrl(obs);
        item.target = '_blank';
        item.rel = 'noopener noreferrer';

        const photo = this.getPhotoUrl(obs, photoAssetSize);
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

        wrap.appendChild(item);
      });

      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(wrap);
      this.gridEl = wrap;
      this.applyGridMetrics();
      if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
        window.requestAnimationFrame(() => this.applyGridMetrics());
      }
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

    getPhotoAssetSize(layoutSize){
      const size = String(layoutSize || '').toLowerCase();
      const dpr = (typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio))
        ? window.devicePixelRatio
        : 1;

      // Requested asset quality from iNaturalist API; it does not set tile size on screen.
      const standardMap = {
        'extra-small': 'square',
        square: 'small',
        small: 'medium',
        medium: 'large',
        large: 'large',
        auto: 'medium'
      };

      const hiDpiMap = {
        'extra-small': 'small',
        square: 'medium',
        small: 'large',
        medium: 'large',
        large: 'large',
        auto: 'large'
      };

      const map = dpr >= 1.5 ? hiDpiMap : standardMap;
      return map[size] || 'medium';
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
