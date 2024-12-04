---
layout: archive
title: Archives
redirect_from:
    - /fantasy-land
    - /dependable-types
---

## Untranslated articles

<ul class="homepage-posts">
  {% for post in site.posts %}
    {% if post.tags contains "untranslated" %}
        <li class="homepage-post">
          <a class="homepage-article-link" href="{{ post.url }}">
            {{ post.title }}
          </a>
        </li>
    {% endif %}
  {% endfor %}
</ul>

