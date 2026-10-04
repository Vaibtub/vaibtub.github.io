(function () {
    'use strict';

    var mirror_url = 'https://rezka-ua.tv/';
    var cors_proxy = 'https://cors.fx666.workers.dev/';

    function startPlugin() {
        // Добавляем компонент в Лампу
        Lampa.Component.add('rezka_ua', function (component) {
            var activity = this;
            var query = activity.search_title;

            activity.render().find('.activity__body').html('<div class="broadcast__text">Поиск на HDrezka UA...</div>');

            $.ajax({
                url: cors_proxy + mirror_url + 'searches/',
                type: 'POST',
                data: { q: query },
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                success: function (html) {
                    var items = $(html).find('a');
                    if (!items.length) {
                        activity.render().find('.activity__body').html('<div class="broadcast__text">Ничего не найдено</div>');
                        return;
                    }

                    var href = $(items[0]).attr('href');
                    
                    $.get(cors_proxy + href, function (pageHtml) {
                        var idMatch = pageHtml.match(/data-post_id="(\d+)"/);
                        if (!idMatch) {
                            activity.render().find('.activity__body').html('<div class="broadcast__text">ID не найден</div>');
                            return;
                        }

                        var postId = idMatch[1];

                        $.ajax({
                            url: cors_proxy + mirror_url + 'ajax/get_cdn_series/?t=' + Date.now(),
                            type: 'POST',
                            data: {
                                id: postId,
                                translator_id: 238,
                                season: 0,
                                episode: 0,
                                action: 'get_movie'
                            },
                            headers: { 'X-Requested-With': 'XMLHttpRequest' },
                            success: function (res) {
                                if (res && res.url) {
                                    // Расшифровка
                                    var str = res.url.replace('#h', '').replace('//_//', '');
                                    ['$$!!@$$@^!@#$$@', '@@%%%%^!!^', '$$#!!@$$#', '^^!@#$$@'].forEach(function (t) {
                                        str = str.split(t).join('');
                                    });
                                    var decoded = atob(str);
                                    var streamUrl = decoded.split(',').pop().replace(/\[.*?\]/, '');

                                    Lampa.Player.play({
                                        url: streamUrl,
                                        title: query
                                    });
                                } else {
                                    activity.render().find('.activity__body').html('<div class="broadcast__text">Поток недоступен</div>');
                                }
                            }
                        });
                    });
                },
                error: function() {
                    activity.render().find('.activity__body').html('<div class="broadcast__text">Ошибка прокси/сети</div>');
                }
            });
        });

        // Слушаем отрисовку карточки фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object.activity.render();
                
                // Проверяем, чтобы кнопка не сдублировалась
                if (render.find('.button--rezka_ua').length) return;

                // Создаем кнопку в стиле Лампы
                var btn = $(
                    '<div class="full-start__button selector button--online button--rezka_ua">' +
                        '<svg height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
                        '<span>HDrezka UA</span>' +
                    '</div>'
                );

                // При нажатии запускаем наш компонент
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'HDrezka UA',
                        component: 'rezka_ua',
                        search_title: e.data.movie.title || e.data.movie.name,
                        movie: e.data.movie
                    });
                });

                // Вставляем кнопку в блок основных кнопок (рядом со "Смотреть")
                render.find('.full-start__buttons').append(btn);
            }
        });
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') startPlugin();
        });
    }
})();
