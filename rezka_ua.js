(function () {
    'use strict';

    var mirror_url = 'https://rezka-ua.tv/';
    var cors_proxy = 'https://cors.nb557.workers.dev/';

    function RezkaUA() {
        this.network = new Lampa.Reguest();
    }

    RezkaUA.prototype.init = function () {
        var self = this;
        
        // Регистрируем источник в Лампе
        Lampa.Component.add('rezka_ua', function (component) {
            self.start(component);
        });

        // Добавляем кнопкой в карточку фильма/сериала
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $('<div class="full-start__button selector button--online"><svg height="24" viewBox="0 0 24 24" width="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span>HDrezka UA</span></div>');
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'HDrezka UA',
                        component: 'rezka_ua',
                        search_title: e.data.movie.title || e.data.movie.name,
                        movie: e.data.movie
                    });
                });
                e.object.activity.render().find('.full-start__buttons').append(btn);
            }
        });
    };

    RezkaUA.prototype.start = function (activity) {
        var self = this;
        var movie = activity.movie;
        var query = activity.search_title;

        activity.render().find('.activity__body').html('<div class="broadcast__text">Поиск на HDrezka UA...</div>');

        var searchUrl = cors_proxy + mirror_url + 'engine/ajax/search.php';
        
        $.ajax({
            url: searchUrl,
            type: 'POST',
            data: { q: query },
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            success: function (html) {
                var items = $(html).find('a');
                if (!items.length) {
                    activity.render().find('.activity__body').html('<div class="broadcast__text">Ничего не найдено</div>');
                    return;
                }

                // Берём первый совпавший результат
                var href = $(items[0]).attr('href');
                self.loadPage(href, activity);
            },
            error: function () {
                activity.render().find('.activity__body').html('<div class="broadcast__text">Ошибка подключения к зеркалу</div>');
            }
        });
    };

    RezkaUA.prototype.loadPage = function (url, activity) {
        var self = this;
        var targetUrl = cors_proxy + url;

        $.get(targetUrl, function (html) {
            var id = html.match(/data-post_id="(\d+)"/);
            if (!id) {
                activity.render().find('.activity__body').html('<div class="broadcast__text">Не удалось прочитать ID видео</div>');
                return;
            }

            var postId = id[1];
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
        var ajaxUrl = cors_proxy + mirror_url + 'ajax/get_cdn_series/?t=' + Date.now();

        $.ajax({
            url: ajaxUrl,
            type: 'POST',
            data: {
                id: id,
                translator_id: 238, // Стандартная озвучка / оригинал / дубляж
                season: season,
                episode: episode,
                action: season ? 'get_stream' : 'get_movie'
            },
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            success: function (res) {
                if (res.success && res.url) {
                    var streamUrl = self.decodeUrl(res.url);
                    self.play(streamUrl, activity);
                } else {
                    Lampa.Noty.show('Не удалось получить поток без авторизации');
                }
            }
        });
    };

    // Декодирование защищенной строки m3u8 от HDrezka
    RezkaUA.prototype.decodeUrl = function (str) {
        if (!str) return '';
        if (str.indexOf('http') === 0) return str;

        try {
            var clean = str.replace('#h', '').replace('//_//', '');
            // Расшифровка базовой подстановки строк HDrezka
            var trashList = ['$$!!@$$@^!@#$$@', '@@%%%%^!!^', '$$#!!@$$#', '^^!@#$$@'];
            trashList.forEach(function (t) {
                clean = clean.split(t).join('');
            });
            var decoded = atob(clean);
            
            // Если отдали несколько качеств (1080p, 720p и т.д.), берем лучшее доступное
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

        // Создаем интерфейс выбора серий в Лампе
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

    if (window.appready) {
        new RezkaUA().init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') new RezkaUA().init();
        });
    }
})();
