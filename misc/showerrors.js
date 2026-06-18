window.t_showErrors = function() {
    if (window.mods === undefined || window.showerrors === true) return;

    let origin = function(){ try { return new URL(window.mods.origin).origin } catch (e) { return '' }}();

    fetch(origin + '/misc/errors.json')
        .then(function(response) { if (!response.ok) { throw new Error('[mods.js] Ошибка: Не удалось загрузить модуль диагностики') }; return response.json() })
        .then(function(json) {
            if (Array.isArray(window.mods.errors)) {
                let modserrors = (json.mods && json.mods.errors) || [];
                window.mods.errors = window.mods.errors.map(function(error) { let moddata = json[error.mod]; if (!moddata || !moddata.errors) return error; let match = moddata.errors.find(function(item) { return item.id === error.id }); if (!match) return error; let { id, ...rest } = match; return Object.assign({}, error, rest) });
                window.mods.errors.forEach(function(error) { if (error.id !== 'dublicate' && error.id !== 'no-selector') return; let item = modserrors.find(function(entry) { return entry.id === error.id }); if (item) error.details = item.details });
            }
            
            let urlparams = new URLSearchParams(window.location.search);
            let rendered = false;
            let icon = false; if (window.mods.extension && urlparams.get('showerrors') === null) icon = true;
            let activeerror, activemod;
            let root, popup, breadcrumbs, body, fade, closebutton, content, iconroot;
            let shield = function(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') };
            let geterrors = function() { return (window.mods && window.mods.errors) || [] };

            let renderheader = function(state) {
                let items = [{ label: 'Модификации', href: 'https://postnikovmd.com/mods' }, { label: 'Диагностика' }];
                let html = '';
                items.forEach(function(item, counter) {
                    let last = counter === items.length - 1;
                    let classlist = 'breadcrumb-button'; if (last) classlist += ' current';
                    if (item.href) { html += '<a class="' + classlist + '" href="' + shield(item.href) + '" target="_blank" rel="noopener"><span>' + shield(item.label) + '</span></a>' } else { html += '<div class="' + classlist + '"><span>' + shield(item.label) + '</span></div>' }
                    if (!last) html += '<div class="breadcrumb-arrow"></div>';
                });
                breadcrumbs.innerHTML = html;

                popup.classList.toggle('detail', state === 'error' || state === 'params');
            };

            let rendercontent = function(state) {
                function renderobject(object, level, prefix) {
                    if (!object || typeof object !== 'object') return '';
                    let html = '';
                    Object.keys(object).forEach(function(key) {
                        let value = object[key];
                        let id = prefix ? prefix + '.' + key : key;
                        let isobject = typeof value === 'object' && value !== null;
                        let isarray = Array.isArray(value); let isset = value instanceof Set;
                        html += renderrow({ id: id, key: key, value: formatvalue(value), indent: level });
                        if (isobject && !isarray && !isset) html += renderobject(value, level + 1, id);
                    });
                    return html;
                };

                let renderparams = function(state) {
                    let bodyhtml = '';
                    if (state === 'error') {
                        let error = activeerror || {};
                        let instance = null; if (window[error.mod] && error.selector) { instance = window[error.mod][error.selector.replace('.uc-', '').replace('#', '')] }; if (instance) { bodyhtml = renderobject(instance, 0, '') } else if (window[error.mod]) {  bodyhtml = renderobject(window[error.mod], 0, '') }
                    } else {
                        let moddata = json.mods || {};
                        let params = moddata.params || [];
                        params.forEach(function(param) {
                            let value = getvalue(window.mods || {}, param.id);
                            let indent = param.id.split('.').length - 1;
                            if ((param.id === 'mods.loaded.sync' || param.id === 'mods.loaded.async') && value instanceof Set) {
                                let tags = Array.from(value).map(function(name) { return '<div class="elem-tag" data-mod="' + shield(name) + '"><span class="elem-tag-label">' + shield(name) + '</span><div class="elem-tag-arrow"></div></div>' }).join('');
                                let paddings = ''; for (let counter = 0; counter < indent; counter++) paddings += '<div class="elem-padding"></div>';
                                bodyhtml += '<div class="elem" data-param="' + shield(param.id) + '">' + paddings + '<div class="elem-content"><div class="elem-key"><p>' + shield(param.name) + '</p></div><div class="elem-value"><div class="elem-tags">' + tags + '</div></div></div></div>';
                            } else {
                                bodyhtml += renderrow({ id: param.id, key: param.name, value: formatvalue(value), indent: indent });
                            }
                        });
                    }

                    if (!bodyhtml) return '';
                    return '<div class="popup-params"><div class="params-more"><span>Все параметры</span><div class="params-more-icon"></div></div><div class="params-body">' + bodyhtml + '</div></div>';
                };

                let renderrow = function(row) {
                    let paddings = ''; for (let counter = 0; counter < (row.indent || 0); counter++) paddings += '<div class="elem-padding"></div>';
                    let key = '<p>' + shield(row.key) + '</p>'; if (row.tag) key += '<div class="elem-tag"><span class="elem-tag-label">' + shield(row.tag) + '</span></div>';
                    let value = ''; if (row.value !== '' && row.value !== undefined && row.value !== null) value = '<p>' + shield(row.value) + '</p>';
                    let elemattr = ''; if (row.id) elemattr = ' data-param="' + shield(row.id) + '"';
                    return '<div class="elem"' + elemattr + '>' + paddings + '<div class="elem-content"><div class="elem-key">' + key + '</div><div class="elem-value">' + value + '</div></div></div>';
                };

                let getvalue = function(root, id) {
                    let parts = id.split('.'); let current = root; for (let counter = 0; counter < parts.length; counter++) { if (current === null || current === undefined) return undefined; current = current[parts[counter]] }
                    return current;
                };

                let formatvalue = function(value) {
                    if (value === undefined || value === null) return '';
                    if (typeof value === 'function') return 'function';
                    if (value instanceof Set) return Array.from(value).join(', ');
                    if (Array.isArray(value)) { let allobjects = value.length > 0 && value.every(function(item) { return typeof item === 'object' && item !== null && !Array.isArray(item) && !(item instanceof Set) }); if (allobjects) return String(value.length); return '[' + value.join(', ') + ']' }
                    if (typeof value === 'object') return '';
                    return String(value);
                };

                let html = '';
                switch (state) {
                    case 'errors': {
                        let errors = geterrors();
                        let cards = '';
                        errors.forEach(function(error, counter) {
                            let moddata = json[error.mod] || {};
                            let type = error.type === 'warn' ? 'warn' : 'error';
                            let title = moddata.tag || error.mod;
                            cards += '<div class="elem-content" data-action="open" data-type="' + type + '" data-index="' + counter + '"><div class="error-icon"></div><div class="error-content"><div class="error-title"><p>' + shield(title) + '</p></div><div class="error-descr"><p>' + shield(error.message || '') + '</p></div></div><div class="error-arrow"></div></div>';
                        });
                        html = '<div class="popup-icon"><div class="icon-error"></div></div><div class="popup-title"><div class="body-title"><p class="title-text">Найдены ошибки</p></div><div class="body-descr"><p class="descr">Данные модификации не работают или работают неправильно</p></div></div><div class="popup-errors">' + cards + '</div>' + renderparams(state);
                        break;
                    }
                    case 'success': {
                        html = '<div class="popup-icon"><div class="icon-success"></div></div><div class="popup-title"><div class="body-title"><p class="title-text">Ошибок не обнаружено</p></div><div class="body-descr"><p class="descr">Все модификации на странице работают корректно</p></div></div>' + renderparams(state);
                        break;
                    }
                    case 'error': {
                        let error = activeerror || {};
                        let moddata = json[error.mod] || {};
                        let moderrors = moddata.errors || [];
                        let modparams = moddata.params || [];
                        let title = moddata.name || error.mod;
                        let locale = moderrors.find(function(item) { return item.id === error.id }) || {};

                        let paramids = locale.params || [];
                        let instance = null; if (window[error.mod] && error.selector) instance = window[error.mod][error.selector.replace('.uc-', '').replace('#', '')];
                        let rows = []; if (error.selector) rows.push({ key: 'Класс блока', value: error.selector });
                        paramids.forEach(function(id) {
                            let def = modparams.find(function(item) { return item.id === id }); if (!def) return;
                            let value; if (instance) value = getvalue(instance, id); else value = undefined;
                            let indent = id.split('.').length - 1;
                            rows.push({ key: def.name, value: formatvalue(value), indent: indent });
                        });
                        let paramshtml = rows.map(renderrow).join('');
                        let tipshtml = ''; if (locale.details) tipshtml = '<div class="error-tips"><div class="tips-title"><p class="subtitle">Как исправить?</p></div><div class="tips-descr"><p class="descr">' + shield(locale.details) + '</p></div></div>';

                        let iconname, prefix; if (error.type === 'warn') { iconname = 'icon-warn'; prefix = 'Предупреждение: ' } else { iconname = 'icon-error'; prefix = 'Ошибка: ' }
                        let url = moddata.url || '';
                        let titlehtml; if (url) titlehtml = '<a class="body-title-link" href="' + shield(url) + '" target="_blank" rel="noopener"><p class="title-text">' + shield(title) + '</p><div class="body-title-icon"></div></a>'; else titlehtml = '<p class="title-text">' + shield(title) + '</p>';
                        html = '<div class="popup-icon"><div class="' + iconname + '"></div></div><div class="popup-title"><div class="body-title">' + titlehtml + '</div><div class="body-descr"><p class="descr">' + shield(prefix + (error.message || '')) + '</p></div></div><div class="popup-details"><div class="error-params">' + paramshtml + '</div>' + tipshtml + '</div>' + renderparams(state);
                        break;
                    }
                    case 'params': {
                        let mod = activemod || '';
                        let moddata = json[mod] || {};
                        let title = moddata.name || mod;
                        let url = moddata.url || '';
                        let dump = renderobject(window[mod] || {}, 0, '');

                        let titlehtml; if (url) { titlehtml = '<a class="body-title-link" href="' + shield(url) + '" target="_blank" rel="noopener"><p class="title-text">' + shield(title) + '</p><div class="body-title-icon"></div></a>' } else { titlehtml = '<p class="title-text">' + shield(title) + '</p><div class="body-title-icon"></div>' }
                        let docshtml; if (url) { docshtml = '<p class="descr">Параметры модификации для отладки. См. подробнее в&nbsp;<a href="' + shield(url + '#docs') + '" target="_blank" rel="noopener">документации</a>.</p>' } else { docshtml = '<p class="descr">Параметры модификации для отладки. См. подробнее в&nbsp;документации.</p>' };
                        html = '<div class="popup-icon"><div class="icon-params"></div></div><div class="popup-title"><div class="body-title">' + titlehtml + '</div><div class="body-descr">' + docshtml + '</div></div><div class="popup-params static open"><div class="params-body">' + dump + '</div></div>';
                        break;
                    }
                }
                body.innerHTML = html;
                body.scrollTop = 0;

                let cards = body.querySelectorAll('[data-action="open"]'); cards.forEach(function(card) { card.addEventListener('click', function() { let index = parseInt(card.getAttribute('data-index'), 10); let errors = geterrors(); let error = errors[index]; if (error) { activeerror = error; render('error') } }) });
                let tags = body.querySelectorAll('.elem-tag[data-mod]'); tags.forEach(function(tag) { tag.addEventListener('click', function() { let mod = tag.getAttribute('data-mod'); if (mod) { activemod = mod; render('params') } }) });
                let more = body.querySelector('.params-more');
                if (more) more.addEventListener('click', function() {
                    let block = more.closest('.popup-params'); if (!block) return;
                    let inner = block.querySelector('.params-body');
                    let isopen = block.classList.contains('open'); if (isopen) { inner.style.maxHeight = inner.scrollHeight + 'px'; requestAnimationFrame(function() { block.classList.remove('open'); inner.style.maxHeight = '0px' }) } else { block.classList.add('open'); let target = inner.scrollHeight; inner.style.maxHeight = '0px'; requestAnimationFrame(function() { inner.style.maxHeight = target + 'px' }) }
                });
            };

            let rendericon = function() {
                let errors = geterrors();
                let count = errors.filter(function(error) { return error.type !== 'warn' }).length; if (count === 0) return;

                let html = '<div class="showerrors-icon hidden"><div class="icon"><div class="icon-img"></div><div class="icon-tag"><p>' + count + '</p></div></div></div>';
                let wrap = document.createElement('div'); wrap.innerHTML = html; iconroot = wrap.firstChild; document.body.appendChild(iconroot);

                iconroot.addEventListener('click', function() {
                    iconroot.classList.add('hidden');
                    activeerror = undefined;
                    activemod = undefined;
                    render('errors');
                    open();
                });

                if (icon) requestAnimationFrame(function() { iconroot.classList.remove('hidden') });
            };

            let render = function(state) {
                if (state === undefined) { if (geterrors().length > 0) { state = 'errors' } else { state = 'success' } }
                if (!rendered) {
                    let buttonhtml; if (state === 'success') { buttonhtml = '<a href="https://postnikovmd.com/mods/support/form#report" target="_blank">Сообщить об ошибке</a>' } else { buttonhtml = '<a href="https://postnikovmd.com/mods/support/form" target="_blank">Нужна помощь?</a>' }
                    let html = '<div class="showerrors closed"><div class="popup-fade"></div><div class="popup"><div class="popup-header"><div class="popup-header-nav"><div class="breadcrumbs"></div><button class="back" type="button"><div class="back-icon"></div><span>Вернуться назад</span></button></div><button class="popup-close" type="button" aria-label="Закрыть"></button></div><div class="popup-content"><div class="popup-content-body"></div><div class="popup-content-bottom"><div class="popup-bottom-copyright"><p>© 2026 Максим Постников</p></div><div class="popup-bottom-version"><div class="popup-bottom-version-text">' + buttonhtml + '</div></div></div></div></div></div>';
                    let wrap = document.createElement('div'); wrap.innerHTML = html; root = wrap.firstChild; document.body.appendChild(root);

                    popup = root.querySelector('.popup');
                    breadcrumbs = root.querySelector('.breadcrumbs');
                    body = root.querySelector('.popup-content-body');
                    content = root.querySelector('.popup-content');
                    fade = root.querySelector('.popup-fade');
                    closebutton = root.querySelector('.popup-close');
                    closebutton.addEventListener('click', close);
                    fade.addEventListener('click', close);
                    root.querySelector('.back').addEventListener('click', function() { activeerror = undefined; activemod = undefined; render(); });

                    rendered = true;
                }

                

                let firstrender = !popup.classList.contains('rendered'); if (firstrender) { renderheader(state); rendercontent(state); popup.classList.add('rendered'); return }
                let oldheight = content.offsetHeight; content.style.height = oldheight + 'px';

                renderheader(state);
                rendercontent(state);

                content.style.height = ''; let newheight = content.offsetHeight; content.style.height = oldheight + 'px';

                requestAnimationFrame(function() { content.style.height = newheight + 'px' });
                content.addEventListener('transitionend', function handler(event) {
                    if (event.propertyName !== 'height') return;
                    content.removeEventListener('transitionend', handler);
                    content.style.height = '';
                });
            };

            let open = function() { if (!root) return; requestAnimationFrame(function() { requestAnimationFrame(function() { root.classList.remove('closed') }) }); document.body.classList.add('t-mods_popupshowed') };
            let close = function() { if (root) root.classList.add('closed'); if (iconroot) iconroot.classList.remove('hidden'); setTimeout(function() { document.body.classList.remove('t-mods_popupshowed') }, 300) };
            let scale = function() {
                if (window.rescale && window.rescale.this) return;
                if (window.tn_scale_factor === undefined || window.tn_scale_factor === 1) return;
                if (root) root.style.setProperty('--scale-factor', Math.min(window.tn_scale_factor, 1.4));
                if (iconroot) iconroot.style.setProperty('--scale-factor', Math.min(window.tn_scale_factor, 1.4));
            };
            let timeout; window.addEventListener('resize', function() { clearTimeout(timeout); timeout = setTimeout(scale, 500) });

            rendericon(); if (!icon) { render(); open() }
            scale();
        });
    window.showerrors = true;
};

t_onReady(function() {
    if (window.mods) {
        let origin = function(){ try { return new URL(window.mods.origin).origin } catch (e) { return '' }}();
        let css = origin + '/misc/showerrors.min.css'; if (!document.querySelector('link[href="' + css + '"]')) { let link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.appendChild(link) }
    }

    let once = false;
    let init = function() { if (!once) { setTimeout(function() { t_showErrors() }, 1e3); once = true } };
    if (document.readyState === 'complete') { init() } else { window.addEventListener('load', init, { once: true }) }
});