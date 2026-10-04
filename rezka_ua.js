(function () {
    'use strict';

    var mirror_url = 'https://rezka-ua.tv/';
    var cors_proxy = 'https://cors.fx666.workers.dev/';

    function RezkaUA() {
        this.network = new Lampa.Reguest();
    }

    RezkaUA.prototype.init = function () {
        var self = this;

        // Регистрируем модуль в системе онлайна Лампы
        Lampa.Component.add('rezka_ua', function (component) {
            self.start(component);
        });

        // Функция добавления кнопки в карточку фильма/сериала
        function addButton(e) {
            var render = e.object.activity.render();
            if (render.find('.button--rezka_ua').length) return; // Защита от дублей

            var btn = $('<div class="full-start__button selector button--online button--rezka_ua"><svg height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span>HDrezka UA</span></div>');
            
            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url: '',
                    title: 'HDrezka UA',
                    component: 'rezka_ua',
                    search_title: e.data.movie.title || e.data.movie.name,
                    movie: e.data.movie
                });
            });

            render.find('.full-start__buttons').append(btn);
        }

        // Слушаем открытие карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite' || e.type == 'render') {
                addButton(e);
            }
        });
    };

    RezkaUA.prototype.start = function (activity) {
        var self = this;
        var query = activity.search_title;

        activity.render().find('.activity__body').html('<div class="broadcast__text">Поиск на HDrezka UA...</div>');

        // Поиск через Worker-прокси
        $.ajax({
            url: cors_proxy + mirror_url + 'searches/',
            type: 'POST',
            data: { q: query },
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            success: function (html) {
                var items = $(html).find('a');
                if (!items.length) {
                    activity.render().find('.activity__body').html('<div class="broadcast__text">Ничего не найдено на HDrezka</div>');
                    return;
                }

                var href = $(items[0]).attr('href');
                self.loadPage(href, activity);
            },
            error: function () {
                activity.render().find('.activity__body').html('<div class="broadcast__text">Ошибка подключения к зеркалу HDrezka</div>');
            }
        });
    };

    RezkaUA.prototype.loadPage = function (url, activity) {
        var self = this;

        $.get(cors_proxy + url, function (html) {
            var idMatch = html.match(/data-post_id="(\d+)"/);
            if (!idMatch) {
                activity.render().find('.activity__body').html('<div class="broadcast__text">Не удалось вытащить ID фильма</div>');
                return;
            }

            var postId = idMatch[1];
            var isSerial = html.indexOf('b-simple_episodes__list') !== -1 || html.indexOf('b-post__seasons') !== -1;

            if (isSerial) {
                self.renderSeasons(html, postId, activity);
            } else {
                self.getStream(postId, 0, 0, activity);
            }
        });
    };

    RezkaUA.prototype.getStream = function (id, season, episode, activity) {
        var self = this;

        $.ajax({
            url: cors_proxy + mirror_url + 'ajax/get_cdn_series/?t=' + Date.now(),
            type: 'POST',
            data: {
                id: id,
                translator_id: 238,
                season: season,
                episode: episode,
                action: season ? 'get_stream' : 'get_movie'
            },
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            success: function (res) {
                if (res && res.url) {
                    var streamUrl = self.decodeUrl(res.url);
                    self.play(streamUrl, activity);
                } else {
                    Lampa.Noty.show('Не удалось получить видеопоток');
                }
            },
            error: function () {
                Lampa.Noty.show('Ошибка запроса к CDN');
            }
        });
    };

    RezkaUA.prototype.decodeUrl = function (str) {
        if (!str) return '';
        if (str.indexOf('http') === 0) return str;

        try {
            var clean = str.replace('#h', '').replace('//_//', '');
            var trashList = ['$$!!@$$@^!@#$$@', '@@%%%%^!!^', '$$#!!@$$#', '^^!@#$$@'];
            trashList.forEach(function (t) {
                clean = clean.split(t).join('');
            });
            var decoded = atob(clean);
            
            var streams = decoded.split(',');
            var lastStream = streams[streams.length - 1];
            var match = lastStream.match(/\](https?:\/\/[^\s,]+)/);
            return match ? match[1] : decoded;
        } catch (e) {
            return str;
        }
    };

    RezkaUA.prototype.renderSeasons = function (html, postId, activity) {
        var self = this;
        var seasons = [];
        $(html).find('.b-simple_episode__item').each(function () {
            seasons.push({
                season: $(this).data('season_id'),
                episode: $(this).data('episode_id'),
                title: $(this).text()
            });
        });

        var list = $('<div class="category-full"><div class="category-full__items"></div></div>');
        seasons.forEach(function (item) {
            var btn = $('<div class="selector category-full__item"><div class="category-full__title">' + item.title + '</div></div>');
            btn.on('hover:enter', function () {
                self.getStream(postId, item.season, item.episode, activity);
            });
            list.find('.category-full__items').append(btn);
        });

        activity.render().find('.activity__body').html(list);
    };

    RezkaUA.prototype.play = function (url, activity) {
        var playData = {
            url: url,
            title: activity.search_title
        };
        Lampa.Player.play(playData);
        Lampa.Player.playlist([playData]);
    };

    // Инициализация плагина
    if (window.appready) {
        new RezkaUA().init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') new RezkaUA().init();
        });
    }
})();
