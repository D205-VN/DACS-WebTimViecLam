import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Calendar, Clock3, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import { blogCategories, blogPosts } from '@shared/content/blogPosts';
import { getBlogDetailRoute } from '@shared/utils/roleRedirect';

function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function BlogPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const deferredQuery = useDeferredValue(query);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return blogPosts.filter((post) => {
      const matchCategory = category === 'Tất cả' || post.category === category;
      const searchable = `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase();
      const matchQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      return matchCategory && matchQuery;
    });
  }, [category, deferredQuery]);

  const featuredPost = useMemo(
    () => filteredPosts.find((post) => post.featured) || filteredPosts[0] || null,
    [filteredPosts]
  );

  const visiblePosts = filteredPosts.filter((post) => post.slug !== featuredPost?.slug);

  return (
    <div className="aw-container py-6">
      <section className="aw-surface px-6 py-8 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Góc chia sẻ nghề nghiệp
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">Blog tuyển dụng, CV và phỏng vấn dành cho người đang tìm việc</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Nội dung ngắn gọn, thực dụng và bám sát quá trình ứng tuyển thực tế: tối ưu CV, đọc JD, chuẩn bị phỏng vấn và xây dựng hồ sơ nghề nghiệp.
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_minmax(0,1fr)]">
        {featuredPost ? (
          <Link
            to={getBlogDetailRoute(user?.role_code, featuredPost.slug)}
            className="group overflow-hidden rounded-lg border border-indigo-50 bg-white shadow-sm transition-all   hover:shadow-indigo-100/40"
          >
            <div className={`h-56 bg-gradient-to-br ${featuredPost.color} p-6 text-white sm:h-64`}>
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                Bài nổi bật
              </div>
              <h2 className="mt-4 max-w-2xl text-2xl font-bold leading-tight">{featuredPost.title}</h2>
              <p className="mt-3 max-w-2xl text-sm text-white/85">{featuredPost.excerpt}</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {featuredPost.category}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(featuredPost.date)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="w-4 h-4" />
                  {featuredPost.readTime}
                </span>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                Đọc bài viết
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ) : null}

        <div className="aw-surface p-6">
          <h2 className="text-lg font-bold text-gray-800">Tìm bài viết</h2>
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo chủ đề, kỹ năng, CV..."
              className="w-full rounded-lg border border-indigo-100/60 py-3 pl-11 pr-4 text-sm text-gray-700 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {blogCategories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  category === item
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                    : 'bg-gradient-to-r from-indigo-50 to-violet-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-indigo-50/50 px-4 py-3 text-sm text-gray-600">
            Hiển thị <span className="font-semibold text-indigo-700">{filteredPosts.length}</span> bài viết phù hợp.
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Bài viết mới</h2>
            <p className="mt-1 text-sm text-gray-500">Nội dung dành cho người đang tối ưu hồ sơ và quá trình ứng tuyển.</p>
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="aw-surface p-10 text-center text-gray-500">
            Không tìm thấy bài viết phù hợp với bộ lọc hiện tại.
          </div>
        ) : visiblePosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visiblePosts.map((post) => (
              <Link
                key={post.slug}
                to={getBlogDetailRoute(user?.role_code, post.slug)}
                className="group overflow-hidden rounded-lg border border-indigo-50 bg-white shadow-sm transition-all   hover:shadow-indigo-100/40"
              >
                <div className={`h-40 bg-gradient-to-br ${post.color} p-5 text-white`}>
                  <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                    {post.category}
                  </div>
                  <h3 className="mt-3 text-xl font-bold leading-tight">{post.title}</h3>
                </div>
                <div className="p-5">
                  <p className="text-sm leading-6 text-gray-600">{post.excerpt}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(post.date)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="w-3.5 h-3.5" />
                      {post.readTime}
                    </span>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                    Xem chi tiết
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
