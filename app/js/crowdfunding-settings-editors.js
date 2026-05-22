/**
 * 大型募資設定：列表型欄位視覺化編輯（取代 JSON 文字輸入）
 */

let onEditorsChange = function () {};

function emitChange() {
    onEditorsChange();
}

function bindInput(el) {
    if (!el) {
        return;
    }
    el.addEventListener('input', emitChange);
    el.addEventListener('change', emitChange);
}

function createField(label, input) {
    const wrap = document.createElement('label');
    wrap.className = 'cfs-field cfs-field--wide';
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
}

function createTextInput(field, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.field = field;
    if (placeholder) {
        input.placeholder = placeholder;
    }
    bindInput(input);
    return input;
}

function createNumberInput(field, min) {
    const input = document.createElement('input');
    input.type = 'number';
    input.dataset.field = field;
    input.min = String(min != null ? min : 0);
    input.step = '1';
    bindInput(input);
    return input;
}

function createTextarea(field, rows) {
    const input = document.createElement('textarea');
    input.dataset.field = field;
    input.rows = rows || 3;
    input.className = 'cfs-list-textarea';
    bindInput(input);
    return input;
}

function createSelect(field, options) {
    const select = document.createElement('select');
    select.dataset.field = field;
    options.forEach(function (opt) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        select.appendChild(o);
    });
    bindInput(select);
    return select;
}

function createCardActions(onMoveUp, onMoveDown, onRemove) {
    const actions = document.createElement('div');
    actions.className = 'cfs-list-actions';

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'btn cfs-btn-muted cfs-btn-icon';
    up.textContent = '↑';
    up.title = '上移';
    up.addEventListener('click', onMoveUp);

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'btn cfs-btn-muted cfs-btn-icon';
    down.textContent = '↓';
    down.title = '下移';
    down.addEventListener('click', onMoveDown);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn cfs-btn-muted cfs-btn-icon cfs-btn-danger';
    del.textContent = '刪除';
    del.addEventListener('click', onRemove);

    actions.appendChild(up);
    actions.appendChild(down);
    actions.appendChild(del);
    return actions;
}

function reorderInContainer(container, card, direction) {
    const sibling =
        direction < 0 ? card.previousElementSibling : card.nextElementSibling;
    if (!sibling) {
        return;
    }
    if (direction < 0) {
        container.insertBefore(card, sibling);
    } else {
        container.insertBefore(sibling, card);
    }
    emitChange();
}

function renderEmptyHint(container, text) {
    container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'cfs-list-empty';
    p.textContent = text;
    container.appendChild(p);
}

// --- 說明區塊 ---

function defaultContentBlock() {
    return {
        anchorId: '',
        anchorLabel: '',
        imageUrl: '',
        bodyText: '',
        sortOrder: 1,
    };
}

function buildContentBlockCard(container, item, index) {
    const card = document.createElement('div');
    card.className = 'cfs-list-card cfs-block-row';
    card.dataset.index = String(index);

    const head = document.createElement('div');
    head.className = 'cfs-list-card-head';
    const title = document.createElement('span');
    title.className = 'cfs-list-card-title';
    title.textContent = '區塊 ' + (index + 1);
    head.appendChild(title);
    head.appendChild(
        createCardActions(
            function () {
                reorderInContainer(container, card, -1);
            },
            function () {
                reorderInContainer(container, card, 1);
            },
            function () {
                card.remove();
                if (!container.querySelector('.cfs-block-row')) {
                    renderEmptyHint(
                        container,
                        '尚無說明區塊，請按「新增區塊」'
                    );
                }
                emitChange();
            }
        )
    );
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'cfs-list-grid';
    const anchorId = createTextInput('anchorId', '英文 id，例如：plan');
    anchorId.value = item.anchorId || '';
    const anchorLabel = createTextInput('anchorLabel', '導覽按鈕文字');
    anchorLabel.value = item.anchorLabel || '';
    const imageUrl = createTextInput('imageUrl', '圖片網址（可留空）');
    imageUrl.value = item.imageUrl || '';
    const bodyText = createTextarea('bodyText', 3);
    bodyText.placeholder = '圖下方說明（可留空；純圖區塊可只填圖片）';
    bodyText.value = item.bodyText || '';

    grid.appendChild(createField('錨點 ID（#連結用）', anchorId));
    grid.appendChild(createField('導覽按鈕文字', anchorLabel));
    grid.appendChild(createField('區塊大圖網址', imageUrl));
    grid.appendChild(createField('說明文字', bodyText));
    card.appendChild(grid);

    container.appendChild(card);
}

export function renderContentBlocksList(items) {
    const container = document.getElementById('contentBlocksList');
    if (!container) {
        return;
    }
    const list = Array.isArray(items) ? items : [];
    container.innerHTML = '';
    if (list.length === 0) {
        renderEmptyHint(container, '尚無說明區塊，請按「新增區塊」');
        return;
    }
    const sorted = [...list].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    sorted.forEach(function (item, i) {
        buildContentBlockCard(container, item, i);
    });
}

export function collectContentBlocks() {
    const container = document.getElementById('contentBlocksList');
    if (!container) {
        return [];
    }
    const rows = [];
    container.querySelectorAll('.cfs-block-row').forEach(function (el, i) {
        const anchorId = el.querySelector('[data-field="anchorId"]').value.trim();
        const anchorLabel = el
            .querySelector('[data-field="anchorLabel"]')
            .value.trim();
        const imageUrl = el.querySelector('[data-field="imageUrl"]').value.trim();
        const bodyText = el.querySelector('[data-field="bodyText"]').value.trim();
        if (!anchorId && !anchorLabel && !imageUrl && !bodyText) {
            return;
        }
        rows.push({
            anchorId: anchorId || 'block-' + (i + 1),
            anchorLabel: anchorLabel || '區塊' + (i + 1),
            imageUrl,
            bodyText,
            sortOrder: i + 1,
        });
    });
    return rows;
}

export function addContentBlockRow() {
    const container = document.getElementById('contentBlocksList');
    if (!container) {
        return;
    }
    const empty = container.querySelector('.cfs-list-empty');
    if (empty) {
        empty.remove();
    }
    const count = container.querySelectorAll('.cfs-block-row').length;
    buildContentBlockCard(container, defaultContentBlock(), count);
    emitChange();
}

// --- 里程碑 ---

function defaultMilestone() {
    return {
        thresholdAmount: 0,
        caption: '',
        outcomeText: '',
        tickPosition: 'below',
        sortOrder: 1,
        markerImageUrl: '',
    };
}

function buildMilestoneCard(container, item, index) {
    const card = document.createElement('div');
    card.className = 'cfs-list-card cfs-milestone-row';
    card.dataset.index = String(index);

    const head = document.createElement('div');
    head.className = 'cfs-list-card-head';
    const title = document.createElement('span');
    title.className = 'cfs-list-card-title';
    title.textContent = '門檻 ' + (index + 1);
    head.appendChild(title);
    head.appendChild(
        createCardActions(
            function () {
                reorderInContainer(container, card, -1);
            },
            function () {
                reorderInContainer(container, card, 1);
            },
            function () {
                card.remove();
                if (!container.querySelector('.cfs-milestone-row')) {
                    renderEmptyHint(
                        container,
                        '尚無里程碑，請按「新增門檻」'
                    );
                }
                emitChange();
            }
        )
    );
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'cfs-list-grid';
    const threshold = createNumberInput('thresholdAmount', 0);
    threshold.value =
        item.thresholdAmount != null ? String(item.thresholdAmount) : '0';
    const caption = createTextInput('caption', '例如：下單優格機…');
    caption.value = item.caption || '';
    const outcome = createTextInput('outcomeText', '達標後額外說明（可留空）');
    outcome.value = item.outcomeText || '';
    const tick = createSelect('tickPosition', [
        { value: 'below', label: '軌道下方（保留欄位）' },
        { value: 'above', label: '軌道上方（保留欄位）' },
    ]);
    tick.value = item.tickPosition === 'above' ? 'above' : 'below';
    const marker = createTextInput('markerImageUrl', '節點圖示網址（可留空）');
    marker.value = item.markerImageUrl || '';

    grid.appendChild(createField('門檻金額（元）', threshold));
    grid.appendChild(createField('達標說明', caption));
    grid.appendChild(createField('達標後說明', outcome));
    grid.appendChild(createField('節點圖示網址', marker));
    card.appendChild(grid);

    container.appendChild(card);
}

export function renderMilestonesList(items) {
    const container = document.getElementById('milestonesList');
    if (!container) {
        return;
    }
    const list = Array.isArray(items) ? items : [];
    container.innerHTML = '';
    if (list.length === 0) {
        renderEmptyHint(container, '尚無里程碑，請按「新增門檻」');
        return;
    }
    const sorted = [...list].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    sorted.forEach(function (item, i) {
        buildMilestoneCard(container, item, i);
    });
}

export function collectMilestones() {
    const container = document.getElementById('milestonesList');
    if (!container) {
        return [];
    }
    const rows = [];
    container.querySelectorAll('.cfs-milestone-row').forEach(function (el, i) {
        const thresholdAmount =
            Number(el.querySelector('[data-field="thresholdAmount"]').value) ||
            0;
        const caption = el.querySelector('[data-field="caption"]').value.trim();
        const outcomeText = el
            .querySelector('[data-field="outcomeText"]')
            .value.trim();
        const tickEl = el.querySelector('[data-field="tickPosition"]');
        const tickPosition =
            tickEl && tickEl.value === 'above' ? 'above' : 'below';
        const markerImageUrl = el
            .querySelector('[data-field="markerImageUrl"]')
            .value.trim();
        if (thresholdAmount <= 0 && !caption) {
            return;
        }
        rows.push({
            thresholdAmount,
            caption,
            outcomeText,
            tickPosition,
            sortOrder: i + 1,
            markerImageUrl,
        });
    });
    return rows;
}

export function addMilestoneRow() {
    const container = document.getElementById('milestonesList');
    if (!container) {
        return;
    }
    const empty = container.querySelector('.cfs-list-empty');
    if (empty) {
        empty.remove();
    }
    const count = container.querySelectorAll('.cfs-milestone-row').length;
    buildMilestoneCard(container, defaultMilestone(), count);
    emitChange();
}

export function initCrowdfundingListEditors(options) {
    onEditorsChange =
        options && typeof options.onChange === 'function'
            ? options.onChange
            : function () {};

    const btnBlock = document.getElementById('btnAddContentBlock');
    const btnMilestone = document.getElementById('btnAddMilestone');

    if (btnBlock) {
        btnBlock.addEventListener('click', addContentBlockRow);
    }
    if (btnMilestone) {
        btnMilestone.addEventListener('click', addMilestoneRow);
    }
}

export function fillAllListEditors(data) {
    const d = data || {};
    renderContentBlocksList(d.contentBlocks);
    renderMilestonesList(d.milestones);
}
