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
  const OBSERVATIONS_PAGE_SIZE = 30;

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
      const colsSetting = this.readGridSetting('inatCols', 'inatColsMode', 4, 1, 24);
      this.colsMode = colsSetting.mode;
      this.cols = colsSetting.count;
      const rowsSetting = this.readGridSetting('inatRows', 'inatRowsMode', 2, 1, 24);
      this.rowsMode = rowsSetting.mode;
      this.rows = rowsSetting.count;

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
      this.pageSize = OBSERVATIONS_PAGE_SIZE;
      this.nextPage = 1;
      this.hasMoreObservations = this.sourceType !== 'observation';
      this.currentCols = this.colsMode === 'fixed' ? Math.max(1, this.cols || 1) : 1;
      this.visibleSlots = this.getInitialVisibleSlots();
      this.isLoadingMore = false;
      this.observationItemEls = [];
      this.previewPhotoSize = '';
      this.loadMoreButtonEl = null;

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
      const raw = (this.readString('inatTileSize') || this.readString('inatPhotoSize'))
        .toLowerCase()
        .replace(/\s+/g, '-');
      const aliases = {
        a: 'a',
        auto: 'a',
        xs: 'xs',
        xsmall: 'xs',
        extrasmall: 'xs',
        'extra-small': 'xs',
        square: 'xs',
        s: 's',
        small: 's',
        m: 'm',
        medium: 'm',
        l: 'l',
        large: 'l'
      };
      const normalized = aliases[raw] || raw;
      const allowed = ['a', 'xs', 's', 'm', 'l'];
      return allowed.includes(normalized) ? normalized : 'a';
    }

    readGridSetting(valueKey, modeKey, fallbackCount, min, max){
      const rawValue = this.readString(valueKey).toLowerCase();
      const rawMode = this.readString(modeKey).toLowerCase();

      const parseCount = (value) => {
        const numeric = Number(value);
        if(!Number.isFinite(numeric) || numeric <= 0) return null;
        return Math.min(max, Math.max(min, Math.floor(numeric)));
      };

      if(rawMode === 'auto'){
        return {mode: 'auto', count: null};
      }

      if(rawMode === 'fixed'){
        return {mode: 'fixed', count: parseCount(rawValue) || fallbackCount};
      }

      if(!rawValue || rawValue === 'auto'){
        return {mode: 'auto', count: null};
      }

      if(rawValue === 'fixed'){
        return {mode: 'fixed', count: fallbackCount};
      }

      const parsed = parseCount(rawValue);
      if(parsed != null){
        return {mode: 'fixed', count: parsed};
      }

      return {mode: 'auto', count: null};
    }

    getInitialVisibleSlots(){
      const minSlots = this.sourceType === 'observation' ? 1 : 2;
      const fallbackCols = this.colsMode === 'fixed' ? Math.max(1, this.cols || 1) : 4;
      if(this.rowsMode === 'fixed'){
        return Math.max(minSlots, Math.max(1, this.rows || 1) * fallbackCols);
      }
      return Math.max(minSlots, this.limit);
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
      if(this.photoSize !== 'a'){
        return this.photoSize;
      }

      if(width <= 420) return 'xs';
      if(width <= 760) return 's';
      if(width <= 1200) return 'm';
      return 'l';
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
        xs: 2,
        s: 0,
        m: 0,
        l: -1,
        a: 0
      };

      const minTileAdjustmentBySize = {
        xs: -20,
        s: 0,
        m: 0,
        l: 0,
        a: 0
      };

      const gapAdjustmentBySize = {
        xs: -2,
        s: 0,
        m: 0,
        l: 0,
        a: 0
      };

      const maxColsBySize = {
        xs: 10,
        s: 8,
        m: 8,
        l: 8,
        a: 8
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
      const targetCols = this.colsMode === 'fixed'
        ? Math.max(1, this.cols || 1)
        : Math.max(
          2,
          Math.min(maxColsBySize[size] || 8, baseColsByWidth + (colAdjustmentBySize[size] || 0))
        );

      return {
        gap,
        minTile,
        targetCols,
        fixedCols: this.colsMode === 'fixed'
      };
    }

    computeColumnsAndGap(width, itemCount){
      const metrics = this.getGridMetrics(width);
      let cols;
      if(metrics.fixedCols){
        cols = Math.max(1, Math.min(itemCount, metrics.targetCols));
      }else{
        const maxColsByMinTile = Math.max(1, Math.floor((width + metrics.gap) / (metrics.minTile + metrics.gap)));
        cols = Math.max(1, Math.min(itemCount, Math.min(metrics.targetCols, maxColsByMinTile)));
      }
      return {cols, gap: metrics.gap};
    }

    applyGridMetrics(){
      if(!this.gridEl) return;

      const width = this.getGridWidth();
      if(width <= 0) return;

      const itemCount = (this.gridItemEls || Array.from(this.gridEl.children))
        .filter((item) => !item.hidden)
        .length;
      if(itemCount <= 0) return;

      const {cols, gap} = this.computeColumnsAndGap(width, itemCount);
      this.currentCols = cols;
      this.gridEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      this.gridEl.style.gap = `${gap}px`;
    }

    getRowIncrement(){
      if(Number.isFinite(this.currentCols) && this.currentCols > 0){
        return Math.max(1, Math.floor(this.currentCols));
      }
      if(this.colsMode === 'fixed'){
        return Math.max(1, this.cols || 1);
      }
      return 4;
    }

    getVisibleObservationCount(){
      const maxSlots = Math.max(1, this.visibleSlots);
      if(this.sourceType === 'observation'){
        return Math.min(this.observations.length, maxSlots);
      }

      let visibleCount = Math.min(this.observations.length, Math.max(0, maxSlots - 1));
      const hasHiddenFromBuffer = this.observations.length > visibleCount;
      const shouldShowLoadMore = this.hasMoreObservations || hasHiddenFromBuffer;

      if(!shouldShowLoadMore){
        visibleCount = Math.min(this.observations.length, maxSlots);
      }

      return visibleCount;
    }

    shouldShowLoadMoreTile(visibleObservationCount){
      if(this.sourceType === 'observation') return false;
      return this.hasMoreObservations || this.observations.length > visibleObservationCount;
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
      userImg.alt = userLabel;
      userImg.hidden = true;
      userImg.addEventListener('load', () => {
        userImg.hidden = false;
      });
      userImg.addEventListener('error', () => {
        userImg.hidden = true;
        userImg.removeAttribute('src');
      });
      this.userImgEl = userImg;
      this.setHeaderUserIcon(this.getHeaderUserIcon());
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
      return this.normalizeExternalUrl(this.userIcon);
    }

    setHeaderUserIcon(iconUrl){
      if(!this.userImgEl) return;
      const icon = this.normalizeExternalUrl(iconUrl);
      if(!icon){
        this.userImgEl.hidden = true;
        this.userImgEl.removeAttribute('src');
        return;
      }
      this.userImgEl.hidden = true;
      this.userImgEl.src = icon;
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
        this.setHeaderUserIcon(iconFromData);
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
          this.setHeaderUserIcon(icon);
        }
      }catch(error){
        console.warn('Could not resolve iNaturalist user icon:', error);
      }
    }

    normalizeObservationSource(value){
      const source = String(value || '').trim();
      const match = source.match(/observations\/(\d+)/);
      return match ? match[1] : source;
    }

    buildObservationParams(page){
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', String(this.pageSize));
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

      return params;
    }

    async fetchObservationPage(page){
      const params = this.buildObservationParams(page);
      const response = await fetch(`${INAT_API}/observations?${params.toString()}`);
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      if(results.length < this.pageSize){
        this.hasMoreObservations = false;
      }
      this.nextPage = page + 1;
      return results;
    }

    async ensureObservationsCount(minCount){
      if(this.sourceType === 'observation') return;
      while(this.observations.length < minCount && this.hasMoreObservations){
        const results = await this.fetchObservationPage(this.nextPage);
        if(!results.length){
          this.hasMoreObservations = false;
          break;
        }
        this.observations.push(...results);
      }
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
          this.hasMoreObservations = false;
        }else{
          this.observations = [];
          this.nextPage = 1;
          this.hasMoreObservations = true;
          await this.ensureObservationsCount(Math.max(1, this.visibleSlots - 1));
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

    async handleLoadMoreClick(){
      if(this.isLoadingMore) return;

      const previousVisibleSlots = this.visibleSlots;
      this.visibleSlots += this.getRowIncrement();
      this.isLoadingMore = true;
      this.renderGrid();

      try{
        await this.ensureObservationsCount(Math.max(1, this.visibleSlots - 1));
      }catch(error){
        console.error('Could not load more observations:', error);
        this.visibleSlots = previousVisibleSlots;
      }finally{
        this.isLoadingMore = false;
      }

      this.applyResolvedUserIcon();
      this.renderGrid();
    }

    renderError(message){
      this.contentEl.innerHTML = `<div class="inat-w-error">${this.escapeHtml(message)}</div>`;
    }

    renderGrid(){
      const photoAssetSize = this.getPhotoAssetSize();
      const visibleObservationCount = this.getVisibleObservationCount();
      const showLoadMoreTile = this.shouldShowLoadMoreTile(visibleObservationCount);
      const hasPhotoAssetSizeChanged = photoAssetSize !== this.previewPhotoSize;

      if(!this.gridEl){
        const wrap = document.createElement('div');
        wrap.className = 'inat-w-grid';
        this.contentEl.innerHTML = '';
        this.contentEl.appendChild(wrap);
        this.gridEl = wrap;
      }

      this.ensureObservationTiles(visibleObservationCount, photoAssetSize);
      if(hasPhotoAssetSizeChanged){
        this.updateObservationTileImages(photoAssetSize);
        this.previewPhotoSize = photoAssetSize;
      }
      this.syncObservationTileVisibility(visibleObservationCount);
      this.syncLoadMoreTileVisibility(showLoadMoreTile);
      this.syncLoadMoreTileState();
      this.gridItemEls = Array.from(this.gridEl.children);
      this.applyGridMetrics();
      if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
        window.requestAnimationFrame(() => this.applyGridMetrics());
      }
    }

    ensureObservationTiles(targetCount, photoAssetSize){
      while(this.observationItemEls.length < targetCount){
        const index = this.observationItemEls.length;
        const obs = this.observations[index];
        if(!obs) break;
        const item = this.createObservationTile(obs, photoAssetSize);
        this.observationItemEls.push(item);
        if(this.loadMoreButtonEl?.parentElement === this.gridEl){
          this.gridEl.insertBefore(item, this.loadMoreButtonEl);
        }else{
          this.gridEl.appendChild(item);
        }
      }
    }

    updateObservationTileImages(photoAssetSize){
      this.observationItemEls.forEach((item, index) => {
        const obs = this.observations[index];
        if(!obs) return;
        const image = item.querySelector('.inat-w-grid-img');
        if(!image) return;
        if(image.dataset.inatSize === photoAssetSize) return;
        const nextPhoto = this.getPhotoUrl(obs, photoAssetSize);
        if(!nextPhoto) return;
        image.src = nextPhoto;
        image.dataset.inatSize = photoAssetSize;
      });
    }

    syncObservationTileVisibility(visibleObservationCount){
      this.observationItemEls.forEach((item, index) => {
        item.hidden = index >= visibleObservationCount;
      });
    }

    syncLoadMoreTileVisibility(showLoadMoreTile){
      if(!showLoadMoreTile){
        if(this.loadMoreButtonEl?.parentElement){
          this.loadMoreButtonEl.remove();
        }
        return;
      }

      if(!this.loadMoreButtonEl){
        this.loadMoreButtonEl = this.createLoadMoreTile();
      }

      if(this.loadMoreButtonEl.parentElement !== this.gridEl){
        this.gridEl.appendChild(this.loadMoreButtonEl);
      }
      this.loadMoreButtonEl.hidden = false;
    }

    syncLoadMoreTileState(){
      if(!this.loadMoreButtonEl) return;
      this.loadMoreButtonEl.disabled = this.isLoadingMore;
      this.loadMoreButtonEl.classList.toggle('is-loading', this.isLoadingMore);
    }

    createObservationTile(obs, photoAssetSize){
      const item = document.createElement('a');
      item.className = 'inat-w-grid-item';
      item.href = this.getPhotoUrl(obs, 'large') || this.getObservationUrl(obs);
      item.target = '_blank';
      item.rel = 'noopener noreferrer';

      const photo = this.getPhotoUrl(obs, photoAssetSize);
      if(photo){
        const image = document.createElement('img');
        image.className = 'inat-w-grid-img';
        image.src = photo;
        image.alt = this.getCommonName(obs);
        image.loading = 'lazy';
        image.decoding = 'async';
        image.dataset.inatSize = photoAssetSize;
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
      return item;
    }

    createLoadMoreTile(){
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inat-w-grid-item inat-w-load-more';
      button.setAttribute('aria-label', 'Load one more row of observations');
      button.title = 'Load one more row';

      const plus = document.createElement('span');
      plus.className = 'inat-w-load-more-plus';
      plus.textContent = '+';
      button.appendChild(plus);

      button.addEventListener('click', () => {
        this.handleLoadMoreClick();
      });

      return button;
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

    getPhotoAssetSize(){
      const width = this.getGridWidth();
      if(width <= 0) return 'medium';

      const visibleObservationCount = this.getVisibleObservationCount();
      const itemCount = Math.max(
        1,
        visibleObservationCount + (this.shouldShowLoadMoreTile(visibleObservationCount) ? 1 : 0)
      );
      const {cols, gap} = this.computeColumnsAndGap(width, itemCount);
      const tileWidth = Math.max(32, Math.floor((width - ((cols - 1) * gap)) / cols));
      const dpr = (
        typeof window !== 'undefined'
        && Number.isFinite(window.devicePixelRatio)
        && window.devicePixelRatio > 0
      ) ? Math.min(2, window.devicePixelRatio) : 1;
      const targetPixels = tileWidth * dpr;

      if(targetPixels <= 150) return 'small';
      if(targetPixels <= 280) return 'medium';
      return 'large';
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
